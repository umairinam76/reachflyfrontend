import {
  useEffect,
  useMemo,
} from "react";
import {
  Link,
  Navigate,
  useParams,
} from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  Calendar,
  Check,
  CheckCircle2,
  Clock3,
  Mail,
  Shield,
  Sparkles,
  Target,
  Workflow,
} from "../components/icons";
import {
  getBlogPost,
  getRelatedPosts,
} from "../content/blog-posts.js";

const SITE_URL =
  "https://www.reachflyai.com";

export default function BlogPostPage() {
  const {
    slug,
  } = useParams();

  const post =
    getBlogPost(
      slug
    );

  const related =
    useMemo(
      () =>
        post
          ? getRelatedPosts(
              post
            )
          : [],
      [
        post,
      ]
    );

  const tableOfContents =
    useMemo(
      () =>
        post
          ? post.sections.map(
              (
                section,
                index
              ) => ({
                id:
                  sectionId(
                    section.heading,
                    index
                  ),
                title:
                  section.heading,
              })
            )
          : [],
      [
        post,
      ]
    );

  useEffect(
    () => {
      if (!post) {
        return undefined;
      }

      const canonical =
        `${SITE_URL}/blog/${post.slug}`;

      const title =
        `${post.title} | ReachFlyAI`;

      document.title =
        title;

      setMeta(
        "description",
        post.description
      );

      setMeta(
        "robots",
        "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"
      );

      setPropertyMeta(
        "og:title",
        title
      );

      setPropertyMeta(
        "og:description",
        post.description
      );

      setPropertyMeta(
        "og:url",
        canonical
      );

      setPropertyMeta(
        "og:type",
        "article"
      );

      setCanonical(
        canonical
      );

      const script =
        document.createElement(
          "script"
        );

      script.type =
        "application/ld+json";

      script.dataset.reachflyBlogSchema =
        post.slug;

      script.text =
        JSON.stringify({
          "@context":
            "https://schema.org",
          "@graph": [
            {
              "@type":
                "Article",
              headline:
                post.title,
              description:
                post.description,
              datePublished:
                post.publishedAt,
              dateModified:
                post.updatedAt,
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
                  SITE_URL,
              },
            },
            {
              "@type":
                "FAQPage",
              mainEntity:
                post.faqs.map(
                  (
                    faq
                  ) => ({
                    "@type":
                      "Question",
                    name:
                      faq.q,
                    acceptedAnswer:
                      {
                        "@type":
                          "Answer",
                        text:
                          faq.a,
                      },
                  })
                ),
            },
          ],
        });

      document.head.appendChild(
        script
      );

      return () =>
        script.remove();
    },
    [
      post,
    ]
  );

  if (!post) {
    return (
      <Navigate
        to="/blog"
        replace
      />
    );
  }

  return (
    <>
      <BlogPostStyles />

      <main className="rf-blog-post-v7">
        <header className="rfbp-nav">
          <Link
            className="rfbp-brand"
            to="/"
            aria-label="ReachFly home"
          >
            <span>
              <BrandLogo size={36} />
            </span>
          </Link>

          <nav>
            <Link to="/">
              Platform
            </Link>

            <Link
              className="active"
              to="/blog"
            >
              Guides
            </Link>

            <Link to="/login">
              Sign in
            </Link>
          </nav>

          <Link
            className="rfbp-button primary"
            to="/signup"
          >
            Get started
            <ArrowRight size={14} />
          </Link>
        </header>

        <div className="rfbp-breadcrumb-wrap">
          <nav
            className="rfbp-breadcrumbs"
            aria-label="Breadcrumb"
          >
            <Link to="/">
              ReachFly
            </Link>

            <span>
              /
            </span>

            <Link to="/blog">
              Guides
            </Link>

            <span>
              /
            </span>

            <span>
              {post.category}
            </span>
          </nav>
        </div>

        <section className="rfbp-hero">
          <div className="rfbp-hero-copy">
            <Link
              className="rfbp-back"
              to="/blog"
            >
              <ArrowLeft size={12} />
              All guides
            </Link>

            <div className="rfbp-label-row">
              <span className="rfbp-kicker">
                <Sparkles size={13} />
                {post.category}
              </span>

              <span>
                {post.intent}
              </span>
            </div>

            <h1>
              {post.title}
            </h1>

            <p>
              {post.description}
            </p>

            <div className="rfbp-meta">
              <span>
                <Calendar size={12} />
                Updated {post.updatedAt}
              </span>

              <span>
                <Clock3 size={12} />
                {post.readingMinutes} min read
              </span>

              <span>
                <Shield size={12} />
                ReachFly editorial guide
              </span>
            </div>
          </div>

          <aside className="rfbp-hero-card">
            <span>
              <Brain size={21} />
            </span>

            <small>
              Guide principle
            </small>

            <strong>
              Keep evidence, ownership, and the next action connected.
            </strong>

            <p>
              The strongest sales workflow is not the one with the most AI
              features. It is the one that lets a team understand why a lead
              matters, what happened, and what should happen next.
            </p>
          </aside>
        </section>

        <section className="rfbp-layout">
          <aside className="rfbp-toc">
            <div>
              <span>
                On this page
              </span>

              <nav>
                {tableOfContents.map(
                  (
                    item
                  ) => (
                    <a
                      key={
                        item.id
                      }
                      href={`#${item.id}`}
                    >
                      {item.title}
                    </a>
                  )
                )}

                <a href="#evaluation-checklist">
                  Evaluation checklist
                </a>

                <a href="#frequently-asked-questions">
                  Frequently asked questions
                </a>
              </nav>

              <div className="rfbp-toc-note">
                <Shield size={13} />

                <p>
                  Treat important prospect facts as evidence to verify, not
                  assumptions to repeat.
                </p>
              </div>
            </div>
          </aside>

          <article className="rfbp-article">
            <section className="rfbp-answer-box">
              <header>
                <span>
                  <Target size={15} />
                </span>

                <div>
                  <small>
                    What matters most
                  </small>

                  <strong>
                    Start with the operating principle.
                  </strong>
                </div>
              </header>

              <p>
                {post.sections[0]?.body}
              </p>
            </section>

            {post.sections.map(
              (
                section,
                index
              ) => (
                <section
                  className="rfbp-copy-section"
                  id={sectionId(
                    section.heading,
                    index
                  )}
                  key={
                    section.heading
                  }
                >
                  <span className="rfbp-section-number">
                    0{index + 1}
                  </span>

                  <h2>
                    {section.heading}
                  </h2>

                  <p>
                    {section.body}
                  </p>

                  <div className="rfbp-operating-rule">
                    <Workflow size={14} />

                    <p>
                      {expandSection(
                        section.heading,
                        post.category
                      )}
                    </p>
                  </div>
                </section>
              )
            )}

            <section
              className="rfbp-copy-section"
              id="evaluation-checklist"
            >
              <span className="rfbp-section-number">
                Check
              </span>

              <h2>
                A practical evaluation checklist
              </h2>

              <p>
                Use these questions when comparing a tool, workflow, or
                operating process against the sales outcome your team actually
                needs.
              </p>

              <ul className="rfbp-checklist">
                {[
                  "Can the system show the source and timestamp for important prospect facts?",
                  "Does it keep unconfirmed information clearly separate from verified evidence?",
                  "Can a rep move from research to a concrete next action without re-entering data?",
                  "Are retries, suppression rules, and failure states visible instead of hidden?",
                  "Can managers measure qualified outcomes rather than only activity volume?",
                ].map(
                  (
                    item
                  ) => (
                    <li key={item}>
                      <span>
                        <Check size={11} />
                      </span>

                      {item}
                    </li>
                  )
                )}
              </ul>
            </section>

            <section
              className="rfbp-copy-section rfbp-faq"
              id="frequently-asked-questions"
            >
              <span className="rfbp-section-number">
                FAQ
              </span>

              <h2>
                Frequently asked questions
              </h2>

              <div>
                {post.faqs.map(
                  (
                    faq
                  ) => (
                    <details key={faq.q}>
                      <summary>
                        {faq.q}
                      </summary>

                      <p>
                        {faq.a}
                      </p>
                    </details>
                  )
                )}
              </div>
            </section>

            <aside className="rfbp-cta">
              <div>
                <span className="rfbp-kicker">
                  <Sparkles size={13} />
                  Put the guide into practice
                </span>

                <h2>
                  Turn research into an actionable sales workflow.
                </h2>

                <p>
                  ReachFly connects lead discovery, evidence-based intelligence,
                  AI-assisted calling, outreach, meetings, and sales operations
                  in one workspace.
                </p>

                <Link
                  className="rfbp-button primary large"
                  to="/signup"
                >
                  Explore ReachFly
                  <ArrowRight size={15} />
                </Link>
              </div>
            </aside>
          </article>

          <aside className="rfbp-related">
            <div>
              <span className="rfbp-related-eyebrow">
                Related guides
              </span>

              <h2>
                Keep reading
              </h2>

              <div>
                {related.map(
                  (
                    item,
                    index
                  ) => (
                    <Link
                      key={
                        item.slug
                      }
                      to={`/blog/${item.slug}`}
                    >
                      <span>
                        0{index + 1}
                      </span>

                      <div>
                        <small>
                          {item.category}
                        </small>

                        <strong>
                          {item.title}
                        </strong>
                      </div>

                      <ArrowRight size={13} />
                    </Link>
                  )
                )}
              </div>

              <Link
                className="rfbp-all-guides"
                to="/blog"
              >
                View all guides
                <ArrowRight size={13} />
              </Link>
            </div>
          </aside>
        </section>

        <footer className="rfbp-footer">
          <Link
            className="rfbp-brand"
            to="/"
          >
            <span>
              <BrandLogo size={34} />
            </span>

         
          </Link>

          <p>
            Practical sales intelligence for lead discovery, AI-assisted
            conversations, follow-up, and connected operations.
          </p>

          <nav>
            <Link to="/blog">
              Guides
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

function sectionId(
  heading,
  index
) {
  const slug =
    String(
      heading ||
        `section-${index + 1}`
    )
      .toLowerCase()
      .replace(
        /[^a-z0-9]+/g,
        "-"
      )
      .replace(
        /^-+|-+$/g,
        ""
      );

  return (
    slug ||
    `section-${index + 1}`
  );
}

function expandSection(
  heading,
  category
) {
  return `For ${String(
    category
  ).toLowerCase()}, treat “${String(
    heading
  ).toLowerCase()}” as an operating rule rather than a one-time checklist. Define what counts as verified, what the fallback should do when a provider is unavailable, and which outcome the team expects next. That makes the workflow easier to train, measure, and improve without asking reps to recreate context manually.`;
}

function setMeta(
  name,
  content
) {
  let node =
    document.querySelector(
      `meta[name="${name}"]`
    );

  if (!node) {
    node =
      document.createElement(
        "meta"
      );

    node.name =
      name;

    document.head.appendChild(
      node
    );
  }

  node.content =
    content;
}

function setPropertyMeta(
  property,
  content
) {
  let node =
    document.querySelector(
      `meta[property="${property}"]`
    );

  if (!node) {
    node =
      document.createElement(
        "meta"
      );

    node.setAttribute(
      "property",
      property
    );

    document.head.appendChild(
      node
    );
  }

  node.content =
    content;
}

function setCanonical(
  href
) {
  let link =
    document.querySelector(
      'link[rel="canonical"]'
    );

  if (!link) {
    link =
      document.createElement(
        "link"
      );

    link.rel =
      "canonical";

    document.head.appendChild(
      link
    );
  }

  link.href =
    href;
}

function BlogPostStyles() {
  return (
    <style>{`
      .rf-blog-post-v7{
        --rfbp-bg:#f8f9fa;
        --rfbp-card:#fff;
        --rfbp-text:#191c1d;
        --rfbp-text2:#4d4c59;
        --rfbp-muted:#777784;
        --rfbp-line:#e2e4e7;
        --rfbp-primary:#4648d4;
        --rfbp-primary-dark:#3739bd;
        --rfbp-primary-soft:#e8e9ff;
        --rfbp-violet:#6b38d4;
        --rfbp-green:#087a51;
        --rfbp-green-soft:#dff8eb;
        --rfbp-dark:#2e3132;
        --rfbp-ease:cubic-bezier(.2,.8,.2,1);
        min-height:100vh;
        color:var(--rfbp-text);
        background:var(--rfbp-bg);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .rf-blog-post-v7 *,
      .rf-blog-post-v7 *::before,
      .rf-blog-post-v7 *::after{
        box-sizing:border-box;
      }

      .rf-blog-post-v7{
        scroll-behavior:smooth;
      }

      .rfbp-nav{
        position:sticky;
        z-index:80;
        top:0;
        min-height:66px;
        display:grid;
        grid-template-columns:auto 1fr auto;
        align-items:center;
        gap:24px;
        padding:0 max(22px,calc((100vw - 1320px)/2));
        background:rgba(248,249,250,.9);
        border-bottom:1px solid rgba(226,228,231,.9);
        backdrop-filter:blur(16px);
      }

      .rfbp-brand{
        display:flex;
        align-items:center;
        gap:8px;
        width:max-content;
        color:var(--rfbp-text);
        text-decoration:none;
      }

      .rfbp-brand > span{
        width:36px;
        height:36px;
        display:grid;
        place-items:center;
      }

      .rfbp-brand > div{
        display:grid;
      }

      .rfbp-brand strong{
        font:600 15px/18px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rfbp-brand small{
        color:var(--rfbp-primary);
        font-size:5.5px;
        font-weight:800;
        letter-spacing:.11em;
        text-transform:uppercase;
      }

      .rfbp-nav > nav{
        justify-self:center;
        display:flex;
        gap:24px;
      }

      .rfbp-nav > nav a{
        color:var(--rfbp-text2);
        text-decoration:none;
        font-size:8px;
        font-weight:650;
      }

      .rfbp-nav > nav a.active,
      .rfbp-nav > nav a:hover{
        color:var(--rfbp-primary);
      }

      .rfbp-button{
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
        transition:.15s var(--rfbp-ease);
      }

      .rfbp-button:hover{
        transform:translateY(-1px);
      }

      .rfbp-button.primary{
        color:#fff;
        background:var(--rfbp-primary);
        border-color:var(--rfbp-primary);
        box-shadow:0 7px 17px rgba(70,72,212,.15);
      }

      .rfbp-button.primary:hover{
        background:var(--rfbp-primary-dark);
      }

      .rfbp-button.large{
        min-height:45px;
        padding:9px 13px;
        font-size:8.5px;
      }

      .rfbp-breadcrumb-wrap{
        background:#fff;
        border-bottom:1px solid var(--rfbp-line);
      }

      .rfbp-breadcrumbs{
        width:min(1240px,calc(100% - 48px));
        min-height:43px;
        display:flex;
        align-items:center;
        gap:7px;
        margin:0 auto;
        overflow:hidden;
        color:var(--rfbp-muted);
        white-space:nowrap;
        font-size:6px;
      }

      .rfbp-breadcrumbs a{
        color:var(--rfbp-text2);
        text-decoration:none;
      }

      .rfbp-breadcrumbs > span:last-child{
        overflow:hidden;
        text-overflow:ellipsis;
      }

      .rfbp-hero{
        display:grid;
        grid-template-columns:minmax(0,1fr) minmax(340px,.55fr);
        align-items:end;
        gap:65px;
        padding:68px max(28px,calc((100vw - 1180px)/2)) 64px;
        color:#fff;
        background:
          radial-gradient(circle at 15% 12%,rgba(89,92,229,.25),transparent 30%),
          radial-gradient(circle at 86% 74%,rgba(107,56,212,.22),transparent 33%),
          #2e3132;
      }

      .rfbp-back{
        width:max-content;
        display:flex;
        align-items:center;
        gap:5px;
        margin-bottom:18px;
        color:rgba(242,244,245,.54);
        text-decoration:none;
        font-size:6.5px;
        font-weight:650;
      }

      .rfbp-label-row{
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:7px;
      }

      .rfbp-kicker{
        width:max-content;
        min-height:28px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        padding:5px 8px;
        color:#d4d5ff;
        background:rgba(84,87,220,.16);
        border:1px solid rgba(160,162,255,.14);
        border-radius:999px;
        font-size:6.5px;
        font-weight:800;
        letter-spacing:.07em;
        text-transform:uppercase;
      }

      .rfbp-label-row > span:last-child{
        padding:5px 7px;
        color:rgba(242,244,245,.56);
        background:rgba(255,255,255,.055);
        border-radius:999px;
        font-size:5.5px;
      }

      .rfbp-hero h1{
        max-width:900px;
        margin:16px 0 0;
        font:600 clamp(40px,5vw,66px)/1.02 Geist,Inter,sans-serif;
        letter-spacing:-.05em;
      }

      .rfbp-hero-copy > p{
        max-width:820px;
        margin:16px 0 0;
        color:rgba(241,243,244,.68);
        font-size:10px;
        line-height:18px;
      }

      .rfbp-meta{
        display:flex;
        flex-wrap:wrap;
        gap:12px;
        margin-top:18px;
        color:rgba(239,241,242,.5);
      }

      .rfbp-meta span{
        display:flex;
        align-items:center;
        gap:5px;
        font-size:6px;
      }

      .rfbp-meta svg{
        color:#bfc0ff;
      }

      .rfbp-hero-card{
        min-height:285px;
        display:flex;
        flex-direction:column;
        justify-content:flex-end;
        padding:22px;
        background:
          radial-gradient(circle at 82% 15%,rgba(89,92,229,.25),transparent 35%),
          rgba(255,255,255,.055);
        border:1px solid rgba(255,255,255,.08);
        border-radius:13px;
      }

      .rfbp-hero-card > span{
        width:43px;
        height:43px;
        display:grid;
        place-items:center;
        margin-bottom:auto;
        color:#d4d5ff;
        background:rgba(70,72,212,.18);
        border-radius:10px;
      }

      .rfbp-hero-card small{
        color:#bfc0ff;
        font-size:5.5px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rfbp-hero-card strong{
        margin-top:4px;
        color:#fff;
        font:600 16px/22px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rfbp-hero-card p{
        margin:7px 0 0;
        color:rgba(241,243,244,.56);
        font-size:6.8px;
        line-height:12px;
      }

      .rfbp-layout{
        width:min(1240px,calc(100% - 48px));
        display:grid;
        grid-template-columns:190px minmax(0,720px) minmax(220px,1fr);
        align-items:start;
        gap:32px;
        margin:0 auto;
        padding:64px 0 90px;
      }

      .rfbp-toc,
      .rfbp-related{
        position:sticky;
        top:92px;
      }

      .rfbp-toc > div,
      .rfbp-related > div{
        overflow:hidden;
        background:#fff;
        border:1px solid var(--rfbp-line);
        border-radius:10px;
      }

      .rfbp-toc > div > span{
        display:block;
        padding:12px 13px 8px;
        color:var(--rfbp-muted);
        font-size:5.5px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rfbp-toc nav{
        display:grid;
        padding:0 7px 8px;
      }

      .rfbp-toc nav a{
        display:block;
        padding:7px 7px;
        color:var(--rfbp-text2);
        border-radius:6px;
        text-decoration:none;
        font-size:6.3px;
        line-height:10px;
      }

      .rfbp-toc nav a:hover{
        color:var(--rfbp-primary);
        background:var(--rfbp-primary-soft);
      }

      .rfbp-toc-note{
        display:flex;
        align-items:flex-start;
        gap:6px;
        padding:10px;
        color:var(--rfbp-primary);
        background:#f7f7fc;
        border-top:1px solid var(--rfbp-line);
      }

      .rfbp-toc-note svg{
        flex:0 0 auto;
      }

      .rfbp-toc-note p{
        margin:0;
        color:var(--rfbp-text2);
        font-size:5.7px;
        line-height:9px;
      }

      .rfbp-article{
        min-width:0;
      }

      .rfbp-answer-box{
        padding:22px;
        margin-bottom:36px;
        background:
          linear-gradient(135deg,#f4f3ff,#fbfbff);
        border:1px solid #dddfff;
        border-radius:11px;
      }

      .rfbp-answer-box > header{
        display:grid;
        grid-template-columns:35px minmax(0,1fr);
        align-items:center;
        gap:8px;
      }

      .rfbp-answer-box > header > span{
        width:35px;
        height:35px;
        display:grid;
        place-items:center;
        color:var(--rfbp-primary);
        background:#fff;
        border-radius:8px;
      }

      .rfbp-answer-box > header > div{
        display:grid;
      }

      .rfbp-answer-box small{
        color:var(--rfbp-primary);
        font-size:5.5px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rfbp-answer-box strong{
        font-size:8px;
      }

      .rfbp-answer-box > p{
        margin:13px 0 0;
        color:var(--rfbp-text2);
        font-size:10px;
        line-height:18px;
      }

      .rfbp-copy-section{
        scroll-margin-top:105px;
        padding:9px 0 42px;
      }

      .rfbp-section-number{
        display:block;
        margin-bottom:7px;
        color:var(--rfbp-primary);
        font-size:6px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rfbp-copy-section h2{
        margin:0;
        font:600 28px/35px Geist,Inter,sans-serif;
        letter-spacing:-.03em;
      }

      .rfbp-copy-section > p{
        margin:13px 0 0;
        color:var(--rfbp-text2);
        font-size:10px;
        line-height:19px;
      }

      .rfbp-operating-rule{
        display:grid;
        grid-template-columns:26px minmax(0,1fr);
        align-items:start;
        gap:8px;
        padding:12px;
        margin-top:16px;
        color:var(--rfbp-violet);
        background:#f3eeff;
        border-radius:8px;
      }

      .rfbp-operating-rule > svg{
        margin-top:2px;
      }

      .rfbp-operating-rule p{
        margin:0;
        color:#514c5e;
        font-size:7.5px;
        line-height:13px;
      }

      .rfbp-checklist{
        display:grid;
        gap:7px;
        padding:0;
        margin:19px 0 0;
        list-style:none;
      }

      .rfbp-checklist li{
        min-height:50px;
        display:grid;
        grid-template-columns:27px minmax(0,1fr);
        align-items:center;
        gap:8px;
        padding:9px 11px;
        background:#fff;
        border:1px solid var(--rfbp-line);
        border-radius:8px;
        color:var(--rfbp-text2);
        font-size:7.5px;
        line-height:13px;
      }

      .rfbp-checklist li > span{
        width:27px;
        height:27px;
        display:grid;
        place-items:center;
        color:#fff;
        background:var(--rfbp-green);
        border-radius:7px;
      }

      .rfbp-faq > div{
        display:grid;
        overflow:hidden;
        margin-top:18px;
        background:#fff;
        border:1px solid var(--rfbp-line);
        border-radius:10px;
      }

      .rfbp-faq details{
        padding:0 13px;
      }

      .rfbp-faq details + details{
        border-top:1px solid #eff0f1;
      }

      .rfbp-faq summary{
        min-height:55px;
        display:flex;
        align-items:center;
        cursor:pointer;
        font-size:7.8px;
        font-weight:700;
      }

      .rfbp-faq details p{
        margin:-3px 0 13px;
        color:var(--rfbp-text2);
        font-size:7.5px;
        line-height:13px;
      }

      .rfbp-cta{
        overflow:hidden;
        padding:32px;
        color:#fff;
        background:
          radial-gradient(circle at 88% 16%,rgba(95,98,235,.25),transparent 31%),
          #2e3132;
        border-radius:13px;
      }

      .rfbp-cta h2{
        max-width:580px;
        margin:13px 0 0;
        font:600 30px/37px Geist,Inter,sans-serif;
        letter-spacing:-.035em;
      }

      .rfbp-cta p{
        max-width:590px;
        margin:9px 0 19px;
        color:rgba(241,243,244,.61);
        font-size:8px;
        line-height:14px;
      }

      .rfbp-related{
        min-width:0;
      }

      .rfbp-related > div{
        padding:14px;
      }

      .rfbp-related-eyebrow{
        display:block;
        color:var(--rfbp-primary);
        font-size:5.5px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rfbp-related h2{
        margin:3px 0 11px;
        font:600 17px/23px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rfbp-related > div > div{
        display:grid;
      }

      .rfbp-related > div > div > a{
        min-height:86px;
        display:grid;
        grid-template-columns:23px minmax(0,1fr) 18px;
        align-items:center;
        gap:7px;
        color:inherit;
        border-top:1px solid #eff0f1;
        text-decoration:none;
      }

      .rfbp-related > div > div > a > span{
        color:#a0a1a9;
        font-size:5.5px;
        font-weight:800;
      }

      .rfbp-related > div > div > a > div{
        min-width:0;
        display:grid;
      }

      .rfbp-related > div > div > a small{
        color:var(--rfbp-primary);
        font-size:5px;
      }

      .rfbp-related > div > div > a strong{
        margin-top:2px;
        font-size:6.5px;
        line-height:10px;
      }

      .rfbp-related > div > div > a > svg{
        color:#a2a3ab;
      }

      .rfbp-all-guides{
        min-height:36px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:5px;
        margin-top:10px;
        color:var(--rfbp-primary);
        background:var(--rfbp-primary-soft);
        border-radius:7px;
        text-decoration:none;
        font-size:6px;
        font-weight:700;
      }

      .rfbp-footer{
        width:min(1240px,calc(100% - 48px));
        min-height:170px;
        display:grid;
        grid-template-columns:auto 1fr auto;
        align-items:start;
        gap:25px;
        margin:0 auto;
        padding:48px 0 38px;
        border-top:1px solid var(--rfbp-line);
      }

      .rfbp-footer > p{
        max-width:410px;
        margin:5px 0 0;
        color:var(--rfbp-muted);
        font-size:6.5px;
        line-height:11px;
      }

      .rfbp-footer nav{
        display:flex;
        gap:15px;
      }

      .rfbp-footer nav a{
        color:var(--rfbp-text2);
        text-decoration:none;
        font-size:6.5px;
      }

      @media(max-width:1100px){
        .rfbp-hero{
          grid-template-columns:1fr;
        }

        .rfbp-hero-card{
          max-width:620px;
        }

        .rfbp-layout{
          grid-template-columns:170px minmax(0,1fr);
        }

        .rfbp-related{
          grid-column:2;
          position:static;
        }

        .rfbp-related > div{
          margin-top:0;
        }
      }

      @media(max-width:780px){
        .rfbp-nav > nav{
          display:none;
        }

        .rfbp-nav{
          grid-template-columns:1fr auto;
        }

        .rfbp-layout{
          grid-template-columns:1fr;
        }

        .rfbp-toc{
          position:static;
        }

        .rfbp-toc nav{
          grid-template-columns:1fr 1fr;
        }

        .rfbp-related{
          grid-column:auto;
        }

        .rfbp-footer{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:620px){
        .rfbp-nav{
          min-height:62px;
          padding:0 14px;
        }

        .rfbp-nav > .rfbp-button{
          min-height:35px;
          padding:6px 8px;
          font-size:7px;
        }

        .rfbp-breadcrumbs{
          width:calc(100% - 28px);
        }

        .rfbp-hero{
          padding:53px 15px 48px;
        }

        .rfbp-hero h1{
          font-size:39px;
        }

        .rfbp-hero-copy > p{
          font-size:9px;
          line-height:16px;
        }

        .rfbp-hero-card{
          min-height:240px;
        }

        .rfbp-layout{
          width:calc(100% - 28px);
          padding:47px 0 68px;
        }

        .rfbp-toc nav{
          grid-template-columns:1fr;
        }

        .rfbp-answer-box{
          padding:17px;
        }

        .rfbp-copy-section h2{
          font-size:24px;
          line-height:31px;
        }

        .rfbp-copy-section > p{
          font-size:9px;
          line-height:17px;
        }

        .rfbp-cta{
          padding:23px;
        }

        .rfbp-cta h2{
          font-size:25px;
          line-height:32px;
        }

        .rfbp-footer{
          width:calc(100% - 28px);
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-blog-post-v7{
          scroll-behavior:auto;
        }

        .rf-blog-post-v7 *,
        .rf-blog-post-v7 *::before,
        .rf-blog-post-v7 *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
