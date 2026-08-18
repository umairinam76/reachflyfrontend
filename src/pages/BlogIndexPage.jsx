import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import {
  ArrowRight,
  Brain,
  Calendar,
  CheckCircle2,
  Clock3,
  Mail,
  Search,
  Shield,
  Sparkles,
  Target,
  X,
} from "../components/icons";
import { BLOG_POSTS } from "../content/blog-posts.js";

const BLOG_CANONICAL =
  "https://www.reachflyai.com/blog";

export default function BlogIndexPage() {
  const [query, setQuery] =
    useState("");

  const [category, setCategory] =
    useState("All");

  useEffect(
    () => {
      setSeo({
        title:
          "ReachFly AI Sales & Marketing Blog | Guides, Automation & Lead Generation",
        description:
          "Practical guides on AI sales automation, marketing, lead generation, website audits, Google Business Profile research, outreach and AI calling.",
        canonical:
          BLOG_CANONICAL,
      });
    },
    []
  );

  const categories =
    useMemo(
      () => {
        const counts =
          new Map();

        BLOG_POSTS.forEach(
          (
            post
          ) => {
            counts.set(
              post.category,
              (
                counts.get(
                  post.category
                ) ||
                0
              ) +
                1
            );
          }
        );

        return [
          {
            name: "All",
            count:
              BLOG_POSTS.length,
          },
          ...Array.from(
            counts.entries()
          )
            .sort(
              (
                a,
                b
              ) =>
                b[1] -
                  a[1] ||
                a[0].localeCompare(
                  b[0]
                )
            )
            .map(
              (
                [
                  name,
                  count,
                ]
              ) => ({
                name,
                count,
              })
            ),
        ];
      },
      []
    );

  const featured =
    BLOG_POSTS[0] ||
    null;

  const posts =
    useMemo(
      () => {
        const value =
          query
            .trim()
            .toLowerCase();

        return BLOG_POSTS.filter(
          (
            post
          ) => {
            const categoryMatches =
              category ===
                "All" ||
              post.category ===
                category;

            if (
              !categoryMatches
            ) {
              return false;
            }

            if (!value) {
              return true;
            }

            return [
              post.title,
              post.category,
              post.intent,
              post.description,
            ]
              .join(" ")
              .toLowerCase()
              .includes(
                value
              );
          }
        );
      },
      [
        category,
        query,
      ]
    );

  const showFeatured =
    Boolean(
      featured &&
        category ===
          "All" &&
        !query.trim()
    );

  return (
    <>
      <BlogIndexStyles />

      <main className="rf-blog-index-v7">
        <header className="rfbi-nav">
          <Link
            className="rfbi-brand"
            to="/"
            aria-label="ReachFly home"
          >
            <span>
              <BrandLogo size={37} />
            </span>

            <div>
              <strong>
                ReachFly
              </strong>

              <small>
                Sales OS
              </small>
            </div>
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
            className="rfbi-button primary"
            to="/signup"
          >
            Get started
            <ArrowRight size={14} />
          </Link>
        </header>

        <section className="rfbi-hero">
          <div className="rfbi-hero-grid" />

          <div className="rfbi-hero-copy">
            <span className="rfbi-kicker">
              <Sparkles size={14} />
              ReachFly Sales Intelligence
            </span>

            <h1>
              Practical guides for AI-assisted sales operations.
            </h1>

            <p>
              Evidence-first playbooks for lead generation, prospect research,
              outreach, AI calling, local visibility, follow-up, and the
              operating systems behind modern sales teams.
            </p>

            <div className="rfbi-search">
              <Search size={17} />

              <input
                aria-label="Search ReachFly guides"
                value={query}
                onChange={(
                  event
                ) =>
                  setQuery(
                    event.target
                      .value
                  )
                }
                placeholder="Search guides, topics, or workflows…"
              />

              {query ? (
                <button
                  type="button"
                  onClick={() =>
                    setQuery("")
                  }
                  aria-label="Clear blog search"
                >
                  <X size={13} />
                </button>
              ) : null}
            </div>

            <div className="rfbi-hero-proof">
              <span>
                <CheckCircle2 size={12} />
                {BLOG_POSTS.length} published guides
              </span>

              <span>
                <Shield size={12} />
                Evidence-first workflow thinking
              </span>

              <span>
                <Target size={12} />
                Built for practical execution
              </span>
            </div>
          </div>

          <div className="rfbi-hero-panel">
            <header>
              <span>
                <Brain size={18} />
              </span>

              <div>
                <small>
                  Editorial focus
                </small>

                <strong>
                  Research → action
                </strong>
              </div>
            </header>

            <div className="rfbi-topic-list">
              {[
                [
                  Target,
                  "Lead generation",
                  "Targeting and qualification",
                ],
                [
                  Brain,
                  "Prospect intelligence",
                  "Evidence and research",
                ],
                [
                  Mail,
                  "Outreach",
                  "Messaging and follow-up",
                ],
                [
                  Calendar,
                  "Sales operations",
                  "Meetings and pipeline",
                ],
              ].map(
                (
                  [
                    Icon,
                    title,
                    text,
                  ]
                ) => (
                  <article key={title}>
                    <span>
                      <Icon size={14} />
                    </span>

                    <div>
                      <strong>
                        {title}
                      </strong>

                      <small>
                        {text}
                      </small>
                    </div>
                  </article>
                )
              )}
            </div>

            <footer>
              <span>
                Updated as the ReachFly product and sales workflow evolve.
              </span>
            </footer>
          </div>
        </section>

        <section className="rfbi-category-section">
          <div className="rfbi-category-scroll">
            {categories.map(
              (
                item
              ) => (
                <button
                  type="button"
                  key={item.name}
                  className={
                    category ===
                    item.name
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setCategory(
                      item.name
                    )
                  }
                >
                  {item.name}
                  <span>
                    {item.count}
                  </span>
                </button>
              )
            )}
          </div>
        </section>

        {showFeatured ? (
          <section className="rfbi-featured">
            <div className="rfbi-featured-copy">
              <span className="rfbi-eyebrow">
                Featured guide
              </span>

              <span className="rfbi-featured-category">
                {featured.category}
              </span>

              <h2>
                <Link
                  to={`/blog/${featured.slug}`}
                >
                  {featured.title}
                </Link>
              </h2>

              <p>
                {featured.description}
              </p>

              <div className="rfbi-meta">
                <span>
                  <Clock3 size={12} />
                  {featured.readingMinutes} min read
                </span>

                <span>
                  <Calendar size={12} />
                  Updated {featured.updatedAt}
                </span>

                <span>
                  {featured.intent}
                </span>
              </div>

              <Link
                className="rfbi-read-link"
                to={`/blog/${featured.slug}`}
              >
                Read the guide
                <ArrowRight size={14} />
              </Link>
            </div>

            <div className="rfbi-featured-visual">
              <div className="rfbi-featured-grid" />

              <span className="rfbi-visual-badge">
                <Sparkles size={14} />
                ReachFly Guide
              </span>

              <div className="rfbi-visual-stack">
                <article>
                  <span>
                    <Target size={16} />
                  </span>

                  <div>
                    <small>
                      Step 01
                    </small>

                    <strong>
                      Find the signal
                    </strong>
                  </div>
                </article>

                <article>
                  <span>
                    <Brain size={16} />
                  </span>

                  <div>
                    <small>
                      Step 02
                    </small>

                    <strong>
                      Verify the context
                    </strong>
                  </div>
                </article>

                <article>
                  <span>
                    <ArrowRight size={16} />
                  </span>

                  <div>
                    <small>
                      Step 03
                    </small>

                    <strong>
                      Take the next action
                    </strong>
                  </div>
                </article>
              </div>
            </div>
          </section>
        ) : null}

        <section className="rfbi-content">
          <header>
            <div>
              <span className="rfbi-eyebrow">
                ReachFly library
              </span>

              <h2>
                {category ===
                "All"
                  ? "All guides"
                  : category}
              </h2>
            </div>

            <p>
              {posts.length}{" "}
              {posts.length ===
              1
                ? "guide"
                : "guides"}
              {query
                ? ` matching “${query.trim()}”`
                : ""}
            </p>
          </header>

          {posts.length ? (
            <div className="rfbi-grid">
              {posts.map(
                (
                  post,
                  index
                ) => (
                  <BlogCard
                    key={
                      post.slug
                    }
                    post={
                      post
                    }
                    index={
                      index
                    }
                  />
                )
              )}
            </div>
          ) : (
            <div className="rfbi-empty">
              <span>
                <Search size={21} />
              </span>

              <h3>
                No guides match those filters
              </h3>

              <p>
                Try a broader search or return to all categories.
              </p>

              <button
                type="button"
                onClick={() => {
                  setQuery("");
                  setCategory(
                    "All"
                  );
                }}
              >
                Show all guides
              </button>
            </div>
          )}
        </section>

        <section className="rfbi-cta">
          <div>
            <span className="rfbi-kicker">
              <Sparkles size={14} />
              Put the playbooks into practice
            </span>

            <h2>
              Turn research into a connected ReachFly sales workflow.
            </h2>

            <p>
              Create a workspace for lead discovery, AI-assisted context,
              conversations, follow-up, meetings, and pipeline activity.
            </p>

            <Link
              className="rfbi-button primary large"
              to="/signup"
            >
              Create your workspace
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>

        <footer className="rfbi-footer">
          <Link
            className="rfbi-brand"
            to="/"
          >
            <span>
              <BrandLogo size={34} />
            </span>

            <div>
              <strong>
                ReachFly
              </strong>

              <small>
                Sales OS
              </small>
            </div>
          </Link>

          <p>
            Practical guidance for lead discovery, AI sales, outreach, and
            connected revenue operations.
          </p>

          <nav>
            <Link to="/">
              Platform
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

function BlogCard({
  post,
  index,
}) {
  const cardIcon =
    index %
      3 ===
    0
      ? Target
      : index %
            3 ===
          1
        ? Brain
        : Sparkles;

  const Icon =
    cardIcon;

  return (
    <article className="rfbi-card">
      <header>
        <span>
          <Icon size={15} />
        </span>

        <em>
          {post.category}
        </em>
      </header>

      <h3>
        <Link
          to={`/blog/${post.slug}`}
        >
          {post.title}
        </Link>
      </h3>

      <p>
        {post.description}
      </p>

      <footer>
        <div>
          <span>
            <Clock3 size={11} />
            {post.readingMinutes} min
          </span>

          <span>
            Updated {post.updatedAt}
          </span>
        </div>

        <Link
          to={`/blog/${post.slug}`}
          aria-label={`Read ${post.title}`}
        >
          <ArrowRight size={14} />
        </Link>
      </footer>
    </article>
  );
}

function setSeo({
  title,
  description,
  canonical,
}) {
  if (
    typeof document ===
    "undefined"
  ) {
    return;
  }

  document.title =
    title;

  setMeta(
    "description",
    description
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
    description
  );

  setPropertyMeta(
    "og:url",
    canonical
  );

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
    canonical;
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

function BlogIndexStyles() {
  return (
    <style>{`
      .rf-blog-index-v7{
        --rfbi-bg:#f8f9fa;
        --rfbi-card:#fff;
        --rfbi-text:#191c1d;
        --rfbi-text2:#4d4c59;
        --rfbi-muted:#777784;
        --rfbi-line:#e2e4e7;
        --rfbi-primary:#4648d4;
        --rfbi-primary-dark:#3739bd;
        --rfbi-primary-soft:#e8e9ff;
        --rfbi-violet:#6b38d4;
        --rfbi-green:#087a51;
        --rfbi-dark:#2e3132;
        --rfbi-ease:cubic-bezier(.2,.8,.2,1);
        min-height:100vh;
        color:var(--rfbi-text);
        background:var(--rfbi-bg);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .rf-blog-index-v7 *,
      .rf-blog-index-v7 *::before,
      .rf-blog-index-v7 *::after{
        box-sizing:border-box;
      }

      .rfbi-nav{
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

      .rfbi-brand{
        display:flex;
        align-items:center;
        gap:8px;
        width:max-content;
        color:var(--rfbi-text);
        text-decoration:none;
      }

      .rfbi-brand > span{
        width:37px;
        height:37px;
        display:grid;
        place-items:center;
      }

      .rfbi-brand > div{
        display:grid;
      }

      .rfbi-brand strong{
        font:600 15px/18px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rfbi-brand small{
        color:var(--rfbi-primary);
        font-size:5.5px;
        font-weight:800;
        letter-spacing:.11em;
        text-transform:uppercase;
      }

      .rfbi-nav > nav{
        justify-self:center;
        display:flex;
        gap:24px;
      }

      .rfbi-nav > nav a{
        color:var(--rfbi-text2);
        text-decoration:none;
        font-size:8px;
        font-weight:650;
      }

      .rfbi-nav > nav a.active,
      .rfbi-nav > nav a:hover{
        color:var(--rfbi-primary);
      }

      .rfbi-button{
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
        transition:.15s var(--rfbi-ease);
      }

      .rfbi-button:hover{
        transform:translateY(-1px);
      }

      .rfbi-button.primary{
        color:#fff;
        background:var(--rfbi-primary);
        border-color:var(--rfbi-primary);
        box-shadow:0 7px 17px rgba(70,72,212,.15);
      }

      .rfbi-button.primary:hover{
        background:var(--rfbi-primary-dark);
      }

      .rfbi-button.large{
        min-height:46px;
        padding:9px 14px;
        font-size:9px;
      }

      .rfbi-hero{
        position:relative;
        min-height:520px;
        display:grid;
        grid-template-columns:minmax(0,1fr) minmax(390px,.65fr);
        align-items:center;
        gap:65px;
        overflow:hidden;
        padding:70px max(28px,calc((100vw - 1240px)/2));
        color:#fff;
        background:
          radial-gradient(circle at 15% 16%,rgba(89,92,229,.26),transparent 30%),
          radial-gradient(circle at 84% 72%,rgba(107,56,212,.22),transparent 34%),
          linear-gradient(145deg,#292c2e,#303335 55%,#292c2e);
      }

      .rfbi-hero-grid{
        position:absolute;
        inset:0;
        opacity:.28;
        background-image:
          linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),
          linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);
        background-size:30px 30px;
        mask-image:linear-gradient(#000,transparent 90%);
      }

      .rfbi-hero-copy,
      .rfbi-hero-panel{
        position:relative;
        z-index:2;
      }

      .rfbi-kicker{
        width:max-content;
        min-height:29px;
        display:inline-flex;
        align-items:center;
        gap:6px;
        padding:5px 8px;
        color:#d3d4ff;
        background:rgba(84,87,220,.16);
        border:1px solid rgba(160,162,255,.14);
        border-radius:999px;
        font-size:7px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rfbi-hero h1{
        max-width:760px;
        margin:16px 0 0;
        color:#fff;
        font:600 clamp(43px,5vw,67px)/1.01 Geist,Inter,sans-serif;
        letter-spacing:-.052em;
      }

      .rfbi-hero-copy > p{
        max-width:700px;
        margin:17px 0 0;
        color:rgba(241,243,244,.68);
        font-size:11px;
        line-height:19px;
      }

      .rfbi-search{
        min-height:51px;
        display:flex;
        align-items:center;
        gap:8px;
        max-width:620px;
        padding:0 12px;
        margin-top:24px;
        color:#9a9ba4;
        background:#fff;
        border:1px solid rgba(255,255,255,.65);
        border-radius:10px;
        box-shadow:0 12px 30px rgba(0,0,0,.12);
      }

      .rfbi-search input{
        min-width:0;
        width:100%;
        height:49px;
        padding:0;
        color:var(--rfbi-text);
        background:transparent;
        border:0;
        outline:0;
        font-size:9px;
      }

      .rfbi-search button{
        width:29px;
        height:29px;
        display:grid;
        place-items:center;
        flex:0 0 29px;
        color:#747580;
        background:#f1f2f4;
        border:0;
        border-radius:7px;
        cursor:pointer;
      }

      .rfbi-hero-proof{
        display:flex;
        flex-wrap:wrap;
        gap:12px;
        margin-top:17px;
        color:rgba(239,241,242,.52);
      }

      .rfbi-hero-proof span{
        display:flex;
        align-items:center;
        gap:5px;
        font-size:6px;
      }

      .rfbi-hero-proof svg{
        color:#bfc0ff;
      }

      .rfbi-hero-panel{
        min-height:330px;
        overflow:hidden;
        background:rgba(255,255,255,.055);
        border:1px solid rgba(255,255,255,.08);
        border-radius:14px;
        backdrop-filter:blur(10px);
      }

      .rfbi-hero-panel > header{
        min-height:70px;
        display:grid;
        grid-template-columns:39px minmax(0,1fr);
        align-items:center;
        gap:9px;
        padding:12px 14px;
        border-bottom:1px solid rgba(255,255,255,.07);
      }

      .rfbi-hero-panel > header > span{
        width:39px;
        height:39px;
        display:grid;
        place-items:center;
        color:#d4d5ff;
        background:rgba(70,72,212,.18);
        border-radius:9px;
      }

      .rfbi-hero-panel > header > div{
        display:grid;
      }

      .rfbi-hero-panel > header small{
        color:rgba(242,244,245,.45);
        font-size:5px;
        text-transform:uppercase;
      }

      .rfbi-hero-panel > header strong{
        color:#fff;
        font-size:9px;
      }

      .rfbi-topic-list{
        display:grid;
        gap:0;
        padding:5px 14px;
      }

      .rfbi-topic-list article{
        min-height:53px;
        display:grid;
        grid-template-columns:30px minmax(0,1fr);
        align-items:center;
        gap:7px;
      }

      .rfbi-topic-list article + article{
        border-top:1px solid rgba(255,255,255,.055);
      }

      .rfbi-topic-list article > span{
        width:30px;
        height:30px;
        display:grid;
        place-items:center;
        color:#bebfff;
        background:rgba(70,72,212,.14);
        border-radius:7px;
      }

      .rfbi-topic-list article > div{
        display:grid;
      }

      .rfbi-topic-list strong{
        color:#f6f7f8;
        font-size:6.5px;
      }

      .rfbi-topic-list small{
        color:rgba(239,241,242,.42);
        font-size:5.5px;
      }

      .rfbi-hero-panel > footer{
        min-height:50px;
        display:flex;
        align-items:center;
        padding:10px 14px;
        color:rgba(239,241,242,.42);
        background:rgba(0,0,0,.06);
        font-size:5.5px;
        line-height:9px;
      }

      .rfbi-category-section{
        position:sticky;
        z-index:40;
        top:66px;
        padding:9px max(20px,calc((100vw - 1240px)/2));
        background:rgba(248,249,250,.95);
        border-bottom:1px solid var(--rfbi-line);
        backdrop-filter:blur(12px);
      }

      .rfbi-category-scroll{
        display:flex;
        gap:5px;
        overflow-x:auto;
        scrollbar-width:none;
      }

      .rfbi-category-scroll::-webkit-scrollbar{
        display:none;
      }

      .rfbi-category-scroll button{
        min-height:31px;
        display:flex;
        align-items:center;
        gap:6px;
        flex:0 0 auto;
        padding:5px 8px;
        color:var(--rfbi-text2);
        background:#fff;
        border:1px solid var(--rfbi-line);
        border-radius:999px;
        cursor:pointer;
        font-size:6px;
        font-weight:650;
      }

      .rfbi-category-scroll button span{
        min-width:18px;
        padding:2px 4px;
        color:#8a8b94;
        background:#f2f3f4;
        border-radius:999px;
        text-align:center;
        font-size:5px;
      }

      .rfbi-category-scroll button.active{
        color:#fff;
        background:var(--rfbi-primary);
        border-color:var(--rfbi-primary);
      }

      .rfbi-category-scroll button.active span{
        color:#fff;
        background:rgba(255,255,255,.16);
      }

      .rfbi-featured{
        width:min(1240px,calc(100% - 48px));
        display:grid;
        grid-template-columns:minmax(0,1fr) minmax(390px,.72fr);
        overflow:hidden;
        margin:70px auto 0;
        background:#fff;
        border:1px solid var(--rfbi-line);
        border-radius:15px;
        box-shadow:0 8px 24px rgba(25,28,29,.035);
      }

      .rfbi-featured-copy{
        padding:38px;
      }

      .rfbi-eyebrow{
        display:block;
        margin-bottom:6px;
        color:var(--rfbi-primary);
        font-size:6.5px;
        font-weight:800;
        letter-spacing:.1em;
        text-transform:uppercase;
      }

      .rfbi-featured-category{
        display:inline-block;
        padding:5px 7px;
        color:#5d2bb8;
        background:#f0eaff;
        border-radius:999px;
        font-size:5.5px;
        font-weight:750;
      }

      .rfbi-featured h2{
        max-width:700px;
        margin:13px 0 0;
        font:600 clamp(28px,3.2vw,42px)/1.08 Geist,Inter,sans-serif;
        letter-spacing:-.038em;
      }

      .rfbi-featured h2 a{
        color:inherit;
        text-decoration:none;
      }

      .rfbi-featured-copy > p{
        max-width:680px;
        margin:11px 0 0;
        color:var(--rfbi-text2);
        font-size:9px;
        line-height:16px;
      }

      .rfbi-meta{
        display:flex;
        flex-wrap:wrap;
        gap:9px;
        margin-top:16px;
        color:var(--rfbi-muted);
      }

      .rfbi-meta span{
        display:flex;
        align-items:center;
        gap:4px;
        font-size:6px;
      }

      .rfbi-read-link{
        display:inline-flex;
        align-items:center;
        gap:6px;
        margin-top:24px;
        color:var(--rfbi-primary);
        text-decoration:none;
        font-size:8px;
        font-weight:750;
      }

      .rfbi-featured-visual{
        position:relative;
        min-height:390px;
        display:flex;
        flex-direction:column;
        justify-content:space-between;
        overflow:hidden;
        padding:25px;
        color:#fff;
        background:
          radial-gradient(circle at 80% 20%,rgba(105,108,241,.30),transparent 31%),
          radial-gradient(circle at 20% 85%,rgba(107,56,212,.22),transparent 30%),
          #2e3132;
      }

      .rfbi-featured-grid{
        position:absolute;
        inset:0;
        opacity:.25;
        background-image:
          linear-gradient(rgba(255,255,255,.04) 1px,transparent 1px),
          linear-gradient(90deg,rgba(255,255,255,.04) 1px,transparent 1px);
        background-size:25px 25px;
      }

      .rfbi-visual-badge{
        position:relative;
        z-index:2;
        width:max-content;
        display:flex;
        align-items:center;
        gap:5px;
        padding:5px 8px;
        color:#d4d5ff;
        background:rgba(70,72,212,.17);
        border-radius:999px;
        font-size:6px;
        font-weight:750;
      }

      .rfbi-visual-stack{
        position:relative;
        z-index:2;
        display:grid;
        gap:7px;
      }

      .rfbi-visual-stack article{
        min-height:63px;
        display:grid;
        grid-template-columns:35px minmax(0,1fr);
        align-items:center;
        gap:8px;
        padding:9px;
        background:rgba(255,255,255,.07);
        border:1px solid rgba(255,255,255,.08);
        border-radius:8px;
        backdrop-filter:blur(8px);
      }

      .rfbi-visual-stack article > span{
        width:35px;
        height:35px;
        display:grid;
        place-items:center;
        color:#d4d5ff;
        background:rgba(70,72,212,.18);
        border-radius:8px;
      }

      .rfbi-visual-stack article > div{
        display:grid;
      }

      .rfbi-visual-stack small{
        color:rgba(239,241,242,.42);
        font-size:5px;
        text-transform:uppercase;
      }

      .rfbi-visual-stack strong{
        color:#fff;
        font-size:7px;
      }

      .rfbi-content{
        width:min(1240px,calc(100% - 48px));
        margin:0 auto;
        padding:75px 0 90px;
      }

      .rfbi-content > header{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:20px;
        margin-bottom:23px;
      }

      .rfbi-content > header h2{
        margin:0;
        font:600 30px/37px Geist,Inter,sans-serif;
        letter-spacing:-.03em;
      }

      .rfbi-content > header > p{
        margin:0;
        color:var(--rfbi-muted);
        font-size:6.5px;
      }

      .rfbi-grid{
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:9px;
      }

      .rfbi-card{
        min-height:310px;
        display:flex;
        flex-direction:column;
        padding:17px;
        background:#fff;
        border:1px solid var(--rfbi-line);
        border-radius:11px;
        transition:
          transform .15s var(--rfbi-ease),
          box-shadow .15s var(--rfbi-ease),
          border-color .15s var(--rfbi-ease);
      }

      .rfbi-card:hover{
        transform:translateY(-2px);
        border-color:#d6d7ef;
        box-shadow:0 12px 28px rgba(25,28,29,.05);
      }

      .rfbi-card > header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
      }

      .rfbi-card > header > span{
        width:35px;
        height:35px;
        display:grid;
        place-items:center;
        color:var(--rfbi-primary);
        background:var(--rfbi-primary-soft);
        border-radius:8px;
      }

      .rfbi-card > header em{
        max-width:70%;
        overflow:hidden;
        color:#7450a9;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:5.5px;
        font-style:normal;
        font-weight:750;
      }

      .rfbi-card h3{
        margin:24px 0 0;
        font:600 14px/20px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rfbi-card h3 a{
        color:inherit;
        text-decoration:none;
      }

      .rfbi-card > p{
        margin:7px 0 0;
        color:var(--rfbi-text2);
        font-size:7.3px;
        line-height:13px;
      }

      .rfbi-card > footer{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:9px;
        margin-top:auto;
        padding-top:16px;
        border-top:1px solid #eff0f1;
      }

      .rfbi-card > footer > div{
        display:flex;
        flex-wrap:wrap;
        gap:8px;
        color:var(--rfbi-muted);
      }

      .rfbi-card > footer span{
        display:flex;
        align-items:center;
        gap:4px;
        font-size:5.5px;
      }

      .rfbi-card > footer > a{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        color:var(--rfbi-primary);
        background:var(--rfbi-primary-soft);
        border-radius:8px;
      }

      .rfbi-empty{
        min-height:320px;
        display:grid;
        place-items:center;
        align-content:center;
        padding:30px;
        background:#fff;
        border:1px dashed #d6d8dc;
        border-radius:12px;
        text-align:center;
      }

      .rfbi-empty > span{
        width:48px;
        height:48px;
        display:grid;
        place-items:center;
        color:var(--rfbi-primary);
        background:var(--rfbi-primary-soft);
        border-radius:12px;
      }

      .rfbi-empty h3{
        margin:12px 0 0;
        font:600 16px/21px Geist,Inter,sans-serif;
      }

      .rfbi-empty p{
        margin:5px 0 0;
        color:var(--rfbi-muted);
        font-size:7px;
      }

      .rfbi-empty button{
        min-height:36px;
        padding:7px 10px;
        margin-top:14px;
        color:#fff;
        background:var(--rfbi-primary);
        border:0;
        border-radius:8px;
        cursor:pointer;
        font-size:7px;
        font-weight:700;
      }

      .rfbi-cta{
        width:min(1240px,calc(100% - 48px));
        margin:0 auto;
        padding:58px;
        overflow:hidden;
        color:#fff;
        background:
          radial-gradient(circle at 90% 20%,rgba(95,98,235,.25),transparent 31%),
          radial-gradient(circle at 10% 80%,rgba(107,56,212,.18),transparent 28%),
          #2e3132;
        border-radius:18px;
      }

      .rfbi-cta > div{
        max-width:820px;
      }

      .rfbi-cta h2{
        margin:14px 0 0;
        font:600 clamp(30px,3.8vw,46px)/1.08 Geist,Inter,sans-serif;
        letter-spacing:-.04em;
      }

      .rfbi-cta p{
        max-width:690px;
        margin:10px 0 21px;
        color:rgba(241,243,244,.62);
        font-size:9px;
        line-height:15px;
      }

      .rfbi-footer{
        width:min(1240px,calc(100% - 48px));
        min-height:170px;
        display:grid;
        grid-template-columns:auto 1fr auto;
        align-items:start;
        gap:25px;
        margin:0 auto;
        padding:48px 0 38px;
      }

      .rfbi-footer > p{
        max-width:390px;
        margin:5px 0 0;
        color:var(--rfbi-muted);
        font-size:6.5px;
        line-height:11px;
      }

      .rfbi-footer nav{
        display:flex;
        gap:15px;
      }

      .rfbi-footer nav a{
        color:var(--rfbi-text2);
        text-decoration:none;
        font-size:6.5px;
      }

      @media(max-width:1050px){
        .rfbi-hero{
          grid-template-columns:1fr;
        }

        .rfbi-hero-panel{
          max-width:700px;
        }

        .rfbi-featured{
          grid-template-columns:1fr;
        }

        .rfbi-featured-visual{
          min-height:300px;
        }

        .rfbi-grid{
          grid-template-columns:1fr 1fr;
        }
      }

      @media(max-width:760px){
        .rfbi-nav > nav{
          display:none;
        }

        .rfbi-nav{
          grid-template-columns:1fr auto;
        }

        .rfbi-footer{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:620px){
        .rfbi-nav{
          min-height:62px;
          padding:0 14px;
        }

        .rfbi-nav > .rfbi-button{
          min-height:35px;
          padding:6px 8px;
          font-size:7px;
        }

        .rfbi-hero{
          min-height:0;
          padding:57px 16px 48px;
        }

        .rfbi-hero h1{
          font-size:41px;
        }

        .rfbi-hero-copy > p{
          font-size:9.5px;
          line-height:16px;
        }

        .rfbi-category-section{
          top:62px;
          padding-left:10px;
          padding-right:10px;
        }

        .rfbi-featured{
          width:calc(100% - 28px);
          margin-top:52px;
        }

        .rfbi-featured-copy{
          padding:24px;
        }

        .rfbi-featured-visual{
          min-height:260px;
          padding:18px;
        }

        .rfbi-content{
          width:calc(100% - 28px);
          padding:58px 0 70px;
        }

        .rfbi-content > header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfbi-grid{
          grid-template-columns:1fr;
        }

        .rfbi-cta{
          width:calc(100% - 28px);
          padding:38px 23px;
          border-radius:14px;
        }

        .rfbi-footer{
          width:calc(100% - 28px);
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-blog-index-v7 *,
        .rf-blog-index-v7 *::before,
        .rf-blog-index-v7 *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
