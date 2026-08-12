import { Link, Navigate, useParams } from "react-router-dom";
import { useEffect } from "react";
import { getBlogPost, getRelatedPosts } from "../content/blog-posts.js";
import "../styles/blog.css";

export default function BlogPostPage() {
  const { slug } = useParams();
  const post = getBlogPost(slug);

  useEffect(() => {
    if (!post) return undefined;
    const canonical = `https://www.reachflyai.com/blog/${post.slug}`;
    document.title = `${post.title} | ReachFly.Ai`;
    setMeta("description", post.description);
    setMeta("robots", "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1");
    setCanonical(canonical);
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.dataset.reachflyBlogSchema = post.slug;
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      headline: post.title,
      description: post.description,
      datePublished: post.publishedAt,
      dateModified: post.updatedAt,
      mainEntityOfPage: canonical,
      author: { "@type": "Organization", name: "ReachFly.Ai" },
      publisher: { "@type": "Organization", name: "ReachFly.Ai", url: "https://www.reachflyai.com" },
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, [post]);

  if (!post) return <Navigate to="/blog" replace />;
  const related = getRelatedPosts(post);

  return (
    <main className="rf-blog-shell rf-blog-article-shell">
      <nav className="rf-blog-breadcrumbs" aria-label="Breadcrumb">
        <Link to="/">ReachFly.Ai</Link><span>/</span><Link to="/blog">Blog</Link><span>/</span><span>{post.category}</span>
      </nav>

      <article className="rf-blog-article">
        <header>
          <span className="rf-blog-kicker">{post.category} · {post.intent}</span>
          <h1>{post.title}</h1>
          <p className="rf-blog-deck">{post.description}</p>
          <div className="rf-blog-meta">Updated {post.updatedAt} · {post.readingMinutes} min read</div>
        </header>

        <section className="rf-blog-answer-box">
          <strong>What matters most</strong>
          <p>{post.sections[0]?.body}</p>
        </section>

        {post.sections.map((section) => (
          <section key={section.heading}>
            <h2>{section.heading}</h2>
            <p>{section.body}</p>
            <p>{expandSection(section.heading, post.category)}</p>
          </section>
        ))}

        <section>
          <h2>A practical evaluation checklist</h2>
          <ul>
            <li>Can the system show the source and timestamp for important prospect facts?</li>
            <li>Does it keep unconfirmed information clearly separate from verified evidence?</li>
            <li>Can a rep move from research to a concrete next action without re-entering data?</li>
            <li>Are retries, suppression rules and failure states visible instead of hidden?</li>
            <li>Can managers measure qualified outcomes rather than only activity volume?</li>
          </ul>
        </section>

        <section>
          <h2>Frequently asked questions</h2>
          {post.faqs.map((faq) => (
            <details key={faq.q}>
              <summary>{faq.q}</summary>
              <p>{faq.a}</p>
            </details>
          ))}
        </section>

        <aside className="rf-blog-cta">
          <h2>Turn research into an actionable sales workflow</h2>
          <p>ReachFly connects lead discovery, evidence-based audits, caller workflows, outreach and sales operations in one workspace.</p>
          <Link to="/signup">Explore ReachFly</Link>
        </aside>
      </article>

      <aside className="rf-related-posts">
        <h2>Related guides</h2>
        {related.map((item) => (
          <Link key={item.slug} to={`/blog/${item.slug}`}>{item.title}</Link>
        ))}
      </aside>
    </main>
  );
}

function expandSection(heading, category) {
  return `For ${category.toLowerCase()}, treat “${heading.toLowerCase()}” as an operating rule rather than a one-time checklist. Define what counts as verified, what the fallback should do when a provider is unavailable, and which outcome the team expects next. That makes the workflow easier to train, measure and improve without asking reps to recreate context manually.`;
}

function setMeta(name, content) {
  let node = document.querySelector(`meta[name="${name}"]`);
  if (!node) {
    node = document.createElement("meta");
    node.name = name;
    document.head.appendChild(node);
  }
  node.content = content;
}

function setCanonical(href) {
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = href;
}
