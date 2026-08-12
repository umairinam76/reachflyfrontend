import { Link } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { BLOG_POSTS } from "../content/blog-posts.js";
import "../styles/blog.css";

export default function BlogIndexPage() {
  const [query, setQuery] = useState("");
  useEffect(() => setSeo({
    title: "ReachFly AI Sales & Marketing Blog | Guides, Automation & Lead Generation",
    description: "Practical guides on AI sales automation, marketing, lead generation, website audits, Google Business Profile research, outreach and AI calling.",
    canonical: "https://www.reachflyai.com/blog",
  }), []);

  const posts = useMemo(() => {
    const value = query.trim().toLowerCase();
    if (!value) return BLOG_POSTS;
    return BLOG_POSTS.filter((post) =>
      [post.title, post.category, post.description].join(" ").toLowerCase().includes(value)
    );
  }, [query]);

  return (
    <main className="rf-blog-shell">
      <header className="rf-blog-hero">
        <Link className="rf-blog-brand" to="/">ReachFly.Ai</Link>
        <span className="rf-blog-kicker">Sales & marketing intelligence</span>
        <h1>Practical AI sales and marketing guides</h1>
        <p>Evidence-first playbooks for lead generation, prospect research, outreach, AI calling, local visibility and sales operations.</p>
        <input
          aria-label="Search blog"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search guides…"
        />
      </header>

      <section className="rf-blog-grid" aria-label="Blog articles">
        {posts.map((post) => (
          <article className="rf-blog-card" key={post.slug}>
            <span>{post.category}</span>
            <h2><Link to={`/blog/${post.slug}`}>{post.title}</Link></h2>
            <p>{post.description}</p>
            <footer>{post.readingMinutes} min read · Updated {post.updatedAt}</footer>
          </article>
        ))}
      </section>
    </main>
  );
}

function setSeo({ title, description, canonical }) {
  document.title = title;
  setMeta("description", description);
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement("link");
    link.rel = "canonical";
    document.head.appendChild(link);
  }
  link.href = canonical;
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
