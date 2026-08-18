import { Link } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import {
  ArrowRight,
  CheckCircle2,
  Mail,
  Shield,
  Sparkles,
} from "../components/icons";
import { useSEO } from "../seo";

const LEGAL_CONTENT = {
  terms: {
    eyebrow: "Legal",
    title: "Terms of Service",
    description:
      "Launch information for the ReachFly Terms of Service. Final production terms must be reviewed and approved for the business, markets, telephony practices, privacy obligations, and billing model actually used.",
    intro:
      "These terms govern use of ReachFlyAI. The production version should describe the actual agreement between ReachFly and its customers, including the services offered, permitted use, billing, telephony responsibilities, AI-assisted features, suspension, termination, and liability terms.",
    noticeTitle: "Production legal review is still required",
    notice:
      "This page remains intentionally labeled as launch information rather than fabricated legal advice. Replace the placeholder sections with counsel-reviewed terms before accepting production customers.",
    sections: [
      {
        title: "1. Service scope",
        body:
          "The final terms should accurately describe the ReachFly services available to customers, including lead discovery, CRM workflows, outreach, AI-assisted calling, meetings, team features, usage credits, and any functionality enabled or disabled for a workspace.",
      },
      {
        title: "2. Account and workspace responsibilities",
        body:
          "The production agreement should explain account ownership, authorized users, role-based access, credential security, customer responsibility for workspace activity, and procedures for compromised or unauthorized access.",
      },
      {
        title: "3. Calling, outreach, and acceptable use",
        body:
          "Because ReachFly supports communications workflows, the final terms should clearly allocate responsibility for lawful calling, messaging, consent, suppression, recording, disclosure, marketing, and jurisdiction-specific outreach requirements.",
      },
      {
        title: "4. AI-assisted features",
        body:
          "The final terms should explain that AI-generated analysis, summaries, messages, and voice interactions can contain errors and should not be treated as guaranteed facts, legal advice, financial advice, or professional determinations without appropriate review.",
      },
      {
        title: "5. Billing and credits",
        body:
          "The final agreement should match the billing model actually deployed, including prepaid credits, calling credits, number-related charges, payment processing, refunds, failed payments, taxes, expiration rules if any, and treatment of unused balances.",
      },
      {
        title: "6. Suspension, termination, and availability",
        body:
          "The production terms should define when access may be limited or suspended, what happens after termination, how service availability is handled, and how data export or deletion requests are processed where applicable.",
      },
    ],
  },

  privacy: {
    eyebrow: "Privacy",
    title: "Privacy Policy",
    description:
      "Launch information for the ReachFly Privacy Policy. Final production privacy terms must reflect the actual data collected, processors used, retention periods, lawful bases, security controls, and regional rights.",
    intro:
      "ReachFlyAI processes workspace, account, lead, communication, usage, billing, and product-operation data to provide the service. The production privacy policy must reflect the systems and processors actually used in the live environment.",
    noticeTitle: "Publish the real data map before production",
    notice:
      "This is a transparent launch placeholder, not a fabricated privacy policy. Final copy should be based on an accurate data inventory and reviewed for the regions where ReachFly and its customers operate.",
    sections: [
      {
        title: "1. Account and workspace data",
        body:
          "The final policy should describe data used to create and administer accounts, including names, email addresses, workspace identity, user roles, profile preferences, authentication activity, and support information.",
      },
      {
        title: "2. Lead and CRM data",
        body:
          "ReachFly workflows can contain business lead records, company information, websites, contact details, notes, campaign context, assignments, audit results, pipeline state, and other information entered, imported, discovered, or generated during sales operations.",
      },
      {
        title: "3. Communication and AI Voice data",
        body:
          "The production policy should accurately describe call metadata, transcripts, recordings when enabled, meeting data, email activity, AI-generated summaries, prompts or context passed to processors, and the retention rules applied to each data type.",
      },
      {
        title: "4. Billing and service telemetry",
        body:
          "The final policy should cover payment-related records, credit usage, transaction identifiers, product analytics, error logs, security events, device or session information, and other operational telemetry actually retained by ReachFly.",
      },
      {
        title: "5. Processors and international transfers",
        body:
          "Publish the processors actually used for hosting, authentication, payments, email, telephony, AI, analytics, or other infrastructure, together with relevant transfer mechanisms and regional disclosures where required.",
      },
      {
        title: "6. Retention, deletion, and user rights",
        body:
          "The production policy should define how long each category of data is retained, how deletion requests are handled, what customers can export, and which access, correction, objection, restriction, portability, or opt-out rights apply by region.",
      },
    ],
  },

  contact: {
    eyebrow: "Support",
    title: "Contact ReachFlyAI",
    description:
      "ReachFly product, account, billing, privacy, and compliance contact information.",
    intro:
      "Use the monitored ReachFly support channel published by your team for product, billing, account, privacy, or compliance questions. Before production launch, replace the contact placeholder below with the real support and legal contact details your team actively monitors.",
    noticeTitle: "Do not publish an unmonitored address",
    notice:
      "A contact page is only useful when the listed channel is actively monitored. Add the production support address, privacy contact, company identity, and any legally required business details before launch.",
    sections: [
      {
        title: "Product and account support",
        body:
          "Publish the monitored support channel customers should use for account access, workspace behavior, product issues, team access, calling readiness, or general ReachFly questions.",
      },
      {
        title: "Billing questions",
        body:
          "Publish the support path for credit purchases, payment questions, transaction issues, refunds where applicable, and business-number or calling-related billing questions.",
      },
      {
        title: "Privacy and compliance",
        body:
          "Publish the monitored privacy or compliance contact for data-subject requests, processor questions, outreach compliance concerns, recording questions, and other privacy-related matters.",
      },
    ],
  },
};

export default function LegalPage({
  kind = "terms",
}) {
  const item =
    LEGAL_CONTENT[kind] ||
    LEGAL_CONTENT.terms;

  const path =
    kind === "privacy"
      ? "/privacy"
      : kind === "contact"
        ? "/contact"
        : "/terms";

  useSEO({
    title: `${item.title} | ReachFlyAI`,
    description:
      item.description,
    path,
    robots:
      "index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1",
  });

  return (
    <>
      <LegalPageStyles />

      <main className="rf-legal-v7">
        <header className="rflg-nav">
          <Link
            className="rflg-brand"
            to="/"
            aria-label="ReachFly home"
          >
            <span>
              <BrandLogo size={37} />
            </span>

           
          </Link>

          <nav>
            <Link
              className={
                kind === "terms"
                  ? "active"
                  : ""
              }
              to="/terms"
            >
              Terms
            </Link>

            <Link
              className={
                kind === "privacy"
                  ? "active"
                  : ""
              }
              to="/privacy"
            >
              Privacy
            </Link>

            <Link
              className={
                kind === "contact"
                  ? "active"
                  : ""
              }
              to="/contact"
            >
              Contact
            </Link>

            <Link to="/blog">
              Guides
            </Link>
          </nav>

          <Link
            className="rflg-button primary"
            to="/signup"
          >
            Get started
            <ArrowRight size={14} />
          </Link>
        </header>

        <section className="rflg-hero">
          <div className="rflg-grid" />

          <div className="rflg-hero-copy">
            <span className="rflg-kicker">
              {kind === "contact" ? (
                <Mail size={14} />
              ) : (
                <Shield size={14} />
              )}

              {item.eyebrow}
            </span>

            <h1>
              {item.title}
            </h1>

            <p>
              {item.intro}
            </p>
          </div>

          <aside>
            <span>
              <Sparkles size={18} />
            </span>

            <small>
              Launch status
            </small>

            <strong>
              {item.noticeTitle}
            </strong>

            <p>
              {item.notice}
            </p>
          </aside>
        </section>

        <section className="rflg-layout">
          <aside className="rflg-sidebar">
            <div>
              <span>
                ReachFly information
              </span>

              <nav>
                <Link
                  className={
                    kind === "terms"
                      ? "active"
                      : ""
                  }
                  to="/terms"
                >
                  Terms of Service
                </Link>

                <Link
                  className={
                    kind === "privacy"
                      ? "active"
                      : ""
                  }
                  to="/privacy"
                >
                  Privacy Policy
                </Link>

                <Link
                  className={
                    kind === "contact"
                      ? "active"
                      : ""
                  }
                  to="/contact"
                >
                  Contact
                </Link>
              </nav>

              <div className="rflg-sidebar-note">
                <Shield size={13} />

                <p>
                  Final production legal copy should match the service and data
                  practices actually deployed.
                </p>
              </div>
            </div>
          </aside>

          <article className="rflg-content">
            <section className="rflg-disclosure">
              <span>
                <Shield size={16} />
              </span>

              <div>
                <strong>
                  Transparent launch placeholder
                </strong>

                <p>
                  {item.notice}
                </p>
              </div>
            </section>

            {item.sections.map(
              (
                section,
                index
              ) => (
                <section
                  className="rflg-section"
                  key={
                    section.title
                  }
                >
                  <span>
                    0{index + 1}
                  </span>

                  <h2>
                    {section.title}
                  </h2>

                  <p>
                    {section.body}
                  </p>
                </section>
              )
            )}

            {kind === "contact" ? (
              <section className="rflg-contact-card">
                <span>
                  <Mail size={18} />
                </span>

                <div>
                  <small>
                    Production requirement
                  </small>

                  <h2>
                    Add your monitored support details before launch.
                  </h2>

                  <p>
                    The supplied source does not provide a verified production
                    support email, company address, or legal contact, so this
                    page does not invent one.
                  </p>
                </div>
              </section>
            ) : null}

            <section className="rflg-next">
              <div>
                <span>
                  <CheckCircle2 size={15} />
                </span>

                <div>
                  <strong>
                    Looking for product information?
                  </strong>

                  <p>
                    Explore ReachFly guides or create a workspace to see the
                    actual product experience.
                  </p>
                </div>
              </div>

              <div className="rflg-next-actions">
                <Link
                  className="rflg-button secondary"
                  to="/blog"
                >
                  Read guides
                </Link>

                <Link
                  className="rflg-button primary"
                  to="/signup"
                >
                  Create workspace
                  <ArrowRight size={14} />
                </Link>
              </div>
            </section>
          </article>
        </section>

        <footer className="rflg-footer">
          <Link
            className="rflg-brand"
            to="/"
          >
            <span>
              <BrandLogo size={34} />
            </span>

          </Link>

          <p>
            Lead discovery, AI-assisted sales conversations, follow-up, and
            connected CRM operations.
          </p>

          <nav>
            <Link to="/terms">
              Terms
            </Link>

            <Link to="/privacy">
              Privacy
            </Link>

            <Link to="/contact">
              Contact
            </Link>

            <Link to="/blog">
              Guides
            </Link>
          </nav>
        </footer>
      </main>
    </>
  );
}

function LegalPageStyles() {
  return (
    <style>{`
      .rf-legal-v7{
        --rflg-bg:#f8f9fa;
        --rflg-card:#fff;
        --rflg-text:#191c1d;
        --rflg-text2:#4d4c59;
        --rflg-muted:#777784;
        --rflg-line:#e2e4e7;
        --rflg-primary:#4648d4;
        --rflg-primary-dark:#3739bd;
        --rflg-primary-soft:#e8e9ff;
        --rflg-violet:#6b38d4;
        --rflg-dark:#2e3132;
        --rflg-ease:cubic-bezier(.2,.8,.2,1);
        min-height:100vh;
        color:var(--rflg-text);
        background:var(--rflg-bg);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .rf-legal-v7 *,
      .rf-legal-v7 *::before,
      .rf-legal-v7 *::after{
        box-sizing:border-box;
      }

      .rflg-nav{
        position:sticky;
        z-index:60;
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

      .rflg-brand{
        display:flex;
        align-items:center;
        gap:8px;
        width:max-content;
        color:var(--rflg-text);
        text-decoration:none;
      }

      .rflg-brand > span{
        width:37px;
        height:37px;
        display:grid;
        place-items:center;
      }

      .rflg-brand > div{
        display:grid;
      }

      .rflg-brand strong{
        font:600 15px/18px Geist,Inter,sans-serif;
        letter-spacing:-.02em;
      }

      .rflg-brand small{
        color:var(--rflg-primary);
        font-size:5.5px;
        font-weight:800;
        letter-spacing:.11em;
        text-transform:uppercase;
      }

      .rflg-nav > nav{
        justify-self:center;
        display:flex;
        align-items:center;
        gap:24px;
      }

      .rflg-nav > nav a{
        color:var(--rflg-text2);
        text-decoration:none;
        font-size:8px;
        font-weight:650;
      }

      .rflg-nav > nav a.active,
      .rflg-nav > nav a:hover{
        color:var(--rflg-primary);
      }

      .rflg-button{
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
        transition:.15s var(--rflg-ease);
      }

      .rflg-button:hover{
        transform:translateY(-1px);
      }

      .rflg-button.primary{
        color:#fff;
        background:var(--rflg-primary);
        border-color:var(--rflg-primary);
        box-shadow:0 7px 17px rgba(70,72,212,.15);
      }

      .rflg-button.primary:hover{
        background:var(--rflg-primary-dark);
      }

      .rflg-button.secondary{
        color:var(--rflg-text2);
        background:#fff;
        border-color:var(--rflg-line);
      }

      .rflg-hero{
        position:relative;
        min-height:390px;
        display:grid;
        grid-template-columns:minmax(0,1fr) minmax(330px,.55fr);
        align-items:end;
        gap:65px;
        overflow:hidden;
        padding:65px max(28px,calc((100vw - 1180px)/2)) 60px;
        color:#fff;
        background:
          radial-gradient(circle at 14% 16%,rgba(89,92,229,.25),transparent 30%),
          radial-gradient(circle at 85% 75%,rgba(107,56,212,.22),transparent 33%),
          #2e3132;
      }

      .rflg-grid{
        position:absolute;
        inset:0;
        opacity:.26;
        pointer-events:none;
        background-image:
          linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),
          linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);
        background-size:30px 30px;
        mask-image:linear-gradient(#000,transparent 90%);
      }

      .rflg-hero-copy,
      .rflg-hero > aside{
        position:relative;
        z-index:2;
      }

      .rflg-kicker{
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
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rflg-hero h1{
        margin:15px 0 0;
        color:#fff;
        font:600 clamp(42px,5vw,64px)/1.02 Geist,Inter,sans-serif;
        letter-spacing:-.05em;
      }

      .rflg-hero-copy > p{
        max-width:800px;
        margin:15px 0 0;
        color:rgba(241,243,244,.68);
        font-size:10px;
        line-height:18px;
      }

      .rflg-hero > aside{
        min-height:250px;
        display:flex;
        flex-direction:column;
        justify-content:flex-end;
        padding:21px;
        background:
          radial-gradient(circle at 84% 15%,rgba(89,92,229,.25),transparent 35%),
          rgba(255,255,255,.055);
        border:1px solid rgba(255,255,255,.08);
        border-radius:13px;
      }

      .rflg-hero > aside > span{
        width:42px;
        height:42px;
        display:grid;
        place-items:center;
        margin-bottom:auto;
        color:#d4d5ff;
        background:rgba(70,72,212,.18);
        border-radius:10px;
      }

      .rflg-hero > aside small{
        color:#bfc0ff;
        font-size:5.5px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rflg-hero > aside strong{
        margin-top:4px;
        color:#fff;
        font:600 15px/21px Geist,Inter,sans-serif;
      }

      .rflg-hero > aside p{
        margin:7px 0 0;
        color:rgba(241,243,244,.56);
        font-size:6.8px;
        line-height:12px;
      }

      .rflg-layout{
        width:min(1120px,calc(100% - 48px));
        display:grid;
        grid-template-columns:210px minmax(0,1fr);
        align-items:start;
        gap:34px;
        margin:0 auto;
        padding:62px 0 90px;
      }

      .rflg-sidebar{
        position:sticky;
        top:91px;
      }

      .rflg-sidebar > div{
        overflow:hidden;
        background:#fff;
        border:1px solid var(--rflg-line);
        border-radius:10px;
      }

      .rflg-sidebar > div > span{
        display:block;
        padding:12px 13px 8px;
        color:var(--rflg-muted);
        font-size:5.5px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rflg-sidebar nav{
        display:grid;
        padding:0 7px 9px;
      }

      .rflg-sidebar nav a{
        min-height:36px;
        display:flex;
        align-items:center;
        padding:7px;
        color:var(--rflg-text2);
        border-radius:6px;
        text-decoration:none;
        font-size:6.5px;
      }

      .rflg-sidebar nav a.active{
        color:var(--rflg-primary);
        background:var(--rflg-primary-soft);
        font-weight:700;
      }

      .rflg-sidebar-note{
        display:flex;
        align-items:flex-start;
        gap:6px;
        padding:10px;
        color:var(--rflg-primary);
        background:#f7f7fc;
        border-top:1px solid var(--rflg-line);
      }

      .rflg-sidebar-note svg{
        flex:0 0 auto;
      }

      .rflg-sidebar-note p{
        margin:0;
        color:var(--rflg-text2);
        font-size:5.7px;
        line-height:9px;
      }

      .rflg-content{
        min-width:0;
      }

      .rflg-disclosure{
        display:grid;
        grid-template-columns:39px minmax(0,1fr);
        align-items:start;
        gap:9px;
        padding:14px;
        margin-bottom:31px;
        color:var(--rflg-primary);
        background:linear-gradient(135deg,#f3f2ff,#fbfbff);
        border:1px solid #dddeff;
        border-radius:10px;
      }

      .rflg-disclosure > span{
        width:39px;
        height:39px;
        display:grid;
        place-items:center;
        background:#fff;
        border-radius:9px;
      }

      .rflg-disclosure strong{
        display:block;
        color:var(--rflg-text);
        font-size:8px;
      }

      .rflg-disclosure p{
        margin:3px 0 0;
        color:var(--rflg-text2);
        font-size:7.5px;
        line-height:13px;
      }

      .rflg-section{
        padding:8px 0 35px;
      }

      .rflg-section > span{
        display:block;
        margin-bottom:7px;
        color:var(--rflg-primary);
        font-size:6px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rflg-section h2{
        margin:0;
        font:600 26px/33px Geist,Inter,sans-serif;
        letter-spacing:-.03em;
      }

      .rflg-section p{
        max-width:790px;
        margin:11px 0 0;
        color:var(--rflg-text2);
        font-size:9px;
        line-height:17px;
      }

      .rflg-contact-card{
        display:grid;
        grid-template-columns:44px minmax(0,1fr);
        align-items:start;
        gap:10px;
        padding:18px;
        margin:4px 0 35px;
        background:#fff;
        border:1px solid var(--rflg-line);
        border-radius:11px;
      }

      .rflg-contact-card > span{
        width:44px;
        height:44px;
        display:grid;
        place-items:center;
        color:var(--rflg-primary);
        background:var(--rflg-primary-soft);
        border-radius:10px;
      }

      .rflg-contact-card small{
        color:var(--rflg-primary);
        font-size:5.5px;
        font-weight:800;
        text-transform:uppercase;
      }

      .rflg-contact-card h2{
        margin:3px 0 0;
        font:600 18px/24px Geist,Inter,sans-serif;
      }

      .rflg-contact-card p{
        margin:6px 0 0;
        color:var(--rflg-text2);
        font-size:7px;
        line-height:12px;
      }

      .rflg-next{
        min-height:105px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:18px;
        padding:16px;
        margin-top:8px;
        background:#fff;
        border:1px solid var(--rflg-line);
        border-radius:11px;
      }

      .rflg-next > div:first-child{
        display:grid;
        grid-template-columns:35px minmax(0,1fr);
        align-items:center;
        gap:8px;
      }

      .rflg-next > div:first-child > span{
        width:35px;
        height:35px;
        display:grid;
        place-items:center;
        color:var(--rflg-primary);
        background:var(--rflg-primary-soft);
        border-radius:8px;
      }

      .rflg-next strong{
        display:block;
        font-size:8px;
      }

      .rflg-next p{
        margin:2px 0 0;
        color:var(--rflg-muted);
        font-size:6.5px;
        line-height:11px;
      }

      .rflg-next-actions{
        display:flex;
        flex-wrap:wrap;
        gap:6px;
      }

      .rflg-footer{
        width:min(1120px,calc(100% - 48px));
        min-height:165px;
        display:grid;
        grid-template-columns:auto 1fr auto;
        align-items:start;
        gap:25px;
        margin:0 auto;
        padding:47px 0 37px;
        border-top:1px solid var(--rflg-line);
      }

      .rflg-footer > p{
        max-width:410px;
        margin:5px 0 0;
        color:var(--rflg-muted);
        font-size:6.5px;
        line-height:11px;
      }

      .rflg-footer nav{
        display:flex;
        flex-wrap:wrap;
        gap:14px;
      }

      .rflg-footer nav a{
        color:var(--rflg-text2);
        text-decoration:none;
        font-size:6.5px;
      }

      @media(max-width:880px){
        .rflg-nav > nav{
          display:none;
        }

        .rflg-nav{
          grid-template-columns:1fr auto;
        }

        .rflg-hero{
          grid-template-columns:1fr;
        }

        .rflg-hero > aside{
          max-width:620px;
        }
      }

      @media(max-width:720px){
        .rflg-layout{
          grid-template-columns:1fr;
        }

        .rflg-sidebar{
          position:static;
        }

        .rflg-sidebar nav{
          grid-template-columns:repeat(3,1fr);
        }

        .rflg-sidebar nav a{
          justify-content:center;
          text-align:center;
        }

        .rflg-footer{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:620px){
        .rflg-nav{
          min-height:62px;
          padding:0 14px;
        }

        .rflg-nav > .rflg-button{
          min-height:35px;
          padding:6px 8px;
          font-size:7px;
        }

        .rflg-hero{
          min-height:0;
          padding:53px 15px 46px;
        }

        .rflg-hero h1{
          font-size:40px;
        }

        .rflg-hero-copy > p{
          font-size:9px;
          line-height:16px;
        }

        .rflg-layout{
          width:calc(100% - 28px);
          padding:45px 0 65px;
        }

        .rflg-sidebar nav{
          grid-template-columns:1fr;
        }

        .rflg-section h2{
          font-size:23px;
          line-height:30px;
        }

        .rflg-section p{
          font-size:8.5px;
          line-height:16px;
        }

        .rflg-next{
          align-items:stretch;
          flex-direction:column;
        }

        .rflg-next-actions{
          display:grid;
          grid-template-columns:1fr 1fr;
        }

        .rflg-footer{
          width:calc(100% - 28px);
        }
      }

      @media(max-width:390px){
        .rflg-next-actions{
          grid-template-columns:1fr;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-legal-v7 *,
        .rf-legal-v7 *::before,
        .rf-legal-v7 *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
