import { Children } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import BrandLogo from "../components/BrandLogo";
import {
  CheckCircle2,
  Shield,
  Sparkles,
} from "../components/icons";

const CAPABILITIES = [
  {
    title: "Lead discovery",
    text: "Find focused prospects and move them into a real sales workflow.",
  },
  {
    title: "AI Voice Agents",
    text: "Run AI-assisted conversations, follow-up, and meeting booking.",
  },
  {
    title: "CRM & outreach",
    text: "Keep campaigns, contacts, inbox activity, and next steps together.",
  },
];

export default function AuthLayout({
  eyebrow,
  title,
  text,
  children,
  footer,
}) {
  const reduceMotion = useReducedMotion();
  const childArray = Children.toArray(children);
  const primaryContent = childArray[0] || null;
  const shellEnhancements = childArray.slice(1);

  return (
    <>
      <AuthLayoutStyles />

      <motion.main
        className="rf-auth-page"
        initial={reduceMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduceMotion ? 0 : 0.35 }}
      >
        <span className="rf-auth-ambient rf-auth-ambient-a" aria-hidden="true" />
        <span className="rf-auth-ambient rf-auth-ambient-b" aria-hidden="true" />
        <span className="rf-auth-grid-bg" aria-hidden="true" />

        <motion.section
          className="rf-auth-shell"
          initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.992 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.2, 0.8, 0.2, 1] }}
        >
          <motion.aside
            className="rf-auth-hero"
            initial={reduceMotion ? false : { opacity: 0, x: -18 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.55, delay: 0.08 }}
          >
            <span className="rf-auth-hero-orbit" aria-hidden="true"><i /><i /><i /></span>
            <div className="rf-auth-hero-top">
              <Link
                className="rf-auth-brand"
                to="/"
                aria-label="ReachFly home"
              >
                <BrandLogo size={42} />

                <span>
                  <b>
                    ReachFly
                  </b>

                  <small>
                    AI
                  </small>
                </span>
              </Link>

              <span className="rf-auth-secure-pill">
                <Shield size={12} />

                Secure workspace
              </span>
            </div>

            <div className="rf-auth-copy">
              <span className="rf-auth-eyebrow">
                <Sparkles size={12} />

                {eyebrow}
              </span>

              <h1>
                {title}
              </h1>

              <p>
                {text}
              </p>
            </div>

            <div className="rf-auth-proof">
              {CAPABILITIES.map(
                (
                  item
                ) => (
                  <article
                    key={
                      item.title
                    }
                  >
                    <span>
                      <CheckCircle2 size={14} />
                    </span>

                    <div>
                      <strong>
                        {item.title}
                      </strong>

                      <small>
                        {item.text}
                      </small>
                    </div>
                  </article>
                )
              )}
            </div>

            <footer className="rf-auth-hero-footer">
              <span>
                AI-native sales workspace
              </span>

              <i />

              <span>
                Built for focused outbound teams
              </span>
            </footer>
          </motion.aside>

          {shellEnhancements.length
            ? shellEnhancements
            : null}

          <motion.section
            className="rf-auth-panel"
            initial={reduceMotion ? false : { opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.5, delay: 0.12 }}
          >
            <motion.div
              className="rf-auth-card"
              whileHover={reduceMotion ? undefined : { y: -2 }}
              transition={{ type: "spring", stiffness: 280, damping: 26 }}
            >
              {primaryContent}
            </motion.div>

            {footer ? (
              <div className="rf-auth-footer">
                {footer}
              </div>
            ) : null}
          </motion.section>
        </motion.section>
      </motion.main>
    </>
  );
}

function AuthLayoutStyles() {
  return (
    <style>{`
      .rf-auth-page{
        --rfa-bg:#f8f9fa;
        --rfa-card:#fff;
        --rfa-text:#191c1d;
        --rfa-text2:#464554;
        --rfa-muted:#767586;
        --rfa-line:#e2e4e7;
        --rfa-primary:#4648d4;
        --rfa-primary-dark:#3537bb;
        --rfa-primary-soft:#e8e9ff;
        --rfa-violet:#6b38d4;
        --rfa-success:#087a51;
        --rfa-danger:#ba1a1a;
        --rfa-danger-soft:#ffedeb;
        --rfa-dark:#2e3132;
        --rfa-ease:cubic-bezier(.2,.8,.2,1);
        min-height:100vh;
        display:grid;
        place-items:center;
        padding:24px;
        color:var(--rfa-text);
        background:
          radial-gradient(circle at 14% 15%,rgba(70,72,212,.08),transparent 28%),
          radial-gradient(circle at 86% 82%,rgba(107,56,212,.06),transparent 28%),
          linear-gradient(180deg,#fafbfc 0%,#f5f6f7 100%);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        overflow-x:hidden;
        animation:rfaPageIn 260ms var(--rfa-ease);
      }

      .rf-auth-page *,
      .rf-auth-page *::before,
      .rf-auth-page *::after{
        box-sizing:border-box;
      }

      .rf-auth-page a{
        color:inherit;
      }

      @keyframes rfaPageIn{
        from{opacity:0}
        to{opacity:1}
      }

      @keyframes rfaHeroIn{
        from{
          opacity:0;
          transform:translate3d(-10px,0,0);
        }
        to{
          opacity:1;
          transform:none;
        }
      }

      @keyframes rfaPanelIn{
        from{
          opacity:0;
          transform:translate3d(0,9px,0);
        }
        to{
          opacity:1;
          transform:none;
        }
      }

      @keyframes rfaGlow{
        0%,100%{
          transform:translate3d(0,0,0);
          opacity:.75;
        }
        50%{
          transform:translate3d(-10px,-8px,0);
          opacity:1;
        }
      }

      .rf-auth-shell{
        position:relative;
        width:min(1180px,100%);
        min-height:min(760px,calc(100vh - 48px));
        display:grid;
        grid-template-columns:minmax(0,1.08fr) minmax(440px,.92fr);
        overflow:hidden;
        background:#fff;
        border:1px solid rgba(221,224,227,.96);
        border-radius:22px;
        box-shadow:
          0 28px 80px rgba(25,28,29,.10),
          0 4px 14px rgba(25,28,29,.04);
      }

      .rf-auth-hero{
        position:relative;
        z-index:1;
        min-width:0;
        min-height:100%;
        display:flex;
        flex-direction:column;
        overflow:hidden;
        padding:34px 38px 27px;
        color:#fff;
        background:
          radial-gradient(circle at 15% 19%,rgba(107,111,255,.29),transparent 32%),
          radial-gradient(circle at 84% 73%,rgba(117,59,216,.25),transparent 34%),
          linear-gradient(145deg,#292c2e 0%,#303336 52%,#292c2f 100%);
        animation:rfaHeroIn 340ms var(--rfa-ease) both;
      }

      .rf-auth-hero::before{
        content:"";
        position:absolute;
        inset:0;
        z-index:-2;
        pointer-events:none;
        opacity:.34;
        background-image:
          linear-gradient(rgba(255,255,255,.035) 1px,transparent 1px),
          linear-gradient(90deg,rgba(255,255,255,.035) 1px,transparent 1px);
        background-size:28px 28px;
        mask-image:linear-gradient(to bottom,#000,transparent 85%);
      }

      .rf-auth-hero::after{
        content:"";
        position:absolute;
        z-index:-1;
        width:470px;
        height:470px;
        left:-195px;
        bottom:-250px;
        pointer-events:none;
        border:1px solid rgba(138,141,255,.17);
        border-radius:50%;
        box-shadow:
          0 0 0 42px rgba(104,106,220,.028),
          0 0 0 88px rgba(104,106,220,.018);
        animation:rfaGlow 9s ease-in-out infinite;
      }

      .rf-auth-hero-top{
        position:relative;
        z-index:3;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:18px;
      }

      .rf-auth-brand{
        display:inline-flex;
        align-items:center;
        gap:10px;
        width:max-content;
        color:#fff!important;
        text-decoration:none;
      }

      .rf-auth-brand > span{
        display:flex;
        align-items:baseline;
        gap:3px;
      }

      .rf-auth-brand b{
        color:#fff;
        font:600 17px/22px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rf-auth-brand small{
        color:#c9caff;
        font-size:6px;
        font-weight:850;
        letter-spacing:.10em;
        text-transform:uppercase;
      }

      .rf-auth-brand img,
      .rf-auth-brand svg{
        filter:drop-shadow(0 5px 14px rgba(0,0,0,.12));
      }

      .rf-auth-secure-pill{
        min-height:29px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        padding:5px 8px;
        color:rgba(242,244,245,.74);
        background:rgba(255,255,255,.055);
        border:1px solid rgba(255,255,255,.08);
        border-radius:999px;
        font-size:6px;
        font-weight:700;
        white-space:nowrap;
        backdrop-filter:blur(7px);
      }

      .rf-auth-copy{
        position:relative;
        z-index:3;
        max-width:520px;
        margin:48px 0 0;
      }

      .rf-auth-eyebrow{
        min-height:28px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        padding:5px 8px;
        color:#cfd0ff;
        background:rgba(86,89,218,.16);
        border:1px solid rgba(157,159,255,.14);
        border-radius:999px;
        font-size:7px;
        font-weight:800;
        letter-spacing:.10em;
        text-transform:uppercase;
      }

      .rf-auth-copy h1{
        max-width:520px;
        margin:14px 0 0;
        color:#fff;
        font:600 clamp(34px,4vw,50px)/1.07 Geist,Inter,sans-serif;
        letter-spacing:-.045em;
      }

      .rf-auth-copy p{
        max-width:480px;
        margin:14px 0 0;
        color:rgba(242,244,245,.69);
        font-size:11px;
        line-height:18px;
      }

      .rf-auth-proof{
        position:relative;
        z-index:3;
        display:grid;
        grid-template-columns:repeat(3,minmax(0,1fr));
        gap:8px;
        margin-top:auto;
        padding-top:34px;
      }

      .rf-auth-proof article{
        min-width:0;
        min-height:104px;
        display:grid;
        grid-template-columns:28px minmax(0,1fr);
        align-content:start;
        gap:7px;
        padding:10px;
        background:rgba(35,38,40,.68);
        border:1px solid rgba(255,255,255,.075);
        border-radius:9px;
        backdrop-filter:blur(8px);
      }

      .rf-auth-proof article > span{
        width:28px;
        height:28px;
        display:grid;
        place-items:center;
        color:#c9caff;
        background:rgba(100,103,229,.15);
        border-radius:7px;
      }

      .rf-auth-proof article > div{
        min-width:0;
      }

      .rf-auth-proof strong{
        display:block;
        color:#f7f8f9;
        font-size:7px;
        line-height:11px;
      }

      .rf-auth-proof small{
        display:block;
        margin-top:2px;
        color:rgba(239,241,242,.48);
        font-size:5.8px;
        line-height:9px;
      }

      .rf-auth-hero-footer{
        position:relative;
        z-index:3;
        min-height:36px;
        display:flex;
        align-items:flex-end;
        gap:7px;
        padding-top:13px;
        color:rgba(239,241,242,.42);
        font-size:5.5px;
        letter-spacing:.02em;
      }

      .rf-auth-hero-footer i{
        width:3px;
        height:3px;
        background:rgba(239,241,242,.30);
        border-radius:50%;
      }

      .rf-auth-panel{
        position:static!important;
        z-index:4;
        min-width:0;
        min-height:100%;
        display:flex;
        flex-direction:column;
        justify-content:center;
        padding:34px clamp(30px,4vw,52px);
        background:
          radial-gradient(circle at 100% 0,rgba(70,72,212,.035),transparent 35%),
          #fff;
      }

      .rf-auth-card{
        width:100%;
        max-width:440px;
        margin:0 auto;
        padding:0;
        background:transparent;
        border:0;
        border-radius:0;
        box-shadow:none;
        animation:rfaPanelIn 340ms 40ms var(--rfa-ease) both;
      }

      .rf-auth-footer{
        width:100%;
        max-width:440px;
        margin:18px auto 0;
        color:var(--rfa-muted);
        text-align:center;
        font-size:7px;
        line-height:12px;
      }

      .rf-auth-footer a{
        color:var(--rfa-primary)!important;
        font-weight:750;
        text-decoration:none;
      }

      .rf-auth-footer a:hover{
        text-decoration:underline;
      }

      /*
       * Shared auth-form compatibility.
       * Individual pages can add more specific scoped styles without needing
       * the legacy global stylesheet.
       */
      .rf-auth-card .rf-auth-form{
        display:grid;
        gap:13px;
        width:100%;
      }

      .rf-auth-card .rf-auth-card-head{
        margin-bottom:2px;
      }

      .rf-auth-card .rf-auth-card-head h2{
        margin:0;
        color:var(--rfa-text);
        font:600 25px/31px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rf-auth-card .rf-auth-card-head p{
        margin:5px 0 0;
        color:var(--rfa-text2);
        font-size:8px;
        line-height:13px;
      }

      .rf-auth-card .rf-auth-error,
      .rf-auth-card .rf-auth-success{
        display:block;
        margin:0;
        padding:9px 10px;
        border:1px solid;
        border-radius:8px;
        font-size:7px;
        line-height:12px;
      }

      .rf-auth-card .rf-auth-error{
        color:#7f1b1b;
        background:var(--rfa-danger-soft);
        border-color:#ffd0cc;
      }

      .rf-auth-card .rf-auth-success{
        color:#075b3d;
        background:#dff8eb;
        border-color:#bbe9d3;
      }

      .rf-auth-card .rf-auth-field,
      .rf-auth-card .rf-auth-input{
        min-width:0;
      }

      .rf-auth-card label.rf-auth-field,
      .rf-auth-card label.rf-auth-input{
        display:grid;
        gap:6px;
        margin:0;
      }

      .rf-auth-card label.rf-auth-field > span,
      .rf-auth-card label.rf-auth-input > span{
        color:var(--rfa-text);
        font-size:7px;
        font-weight:700;
      }

      .rf-auth-card .rf-auth-field > div,
      .rf-auth-card label.rf-auth-input > div{
        min-height:44px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:0 10px;
        color:#8b8c95;
        background:#fff;
        border:1px solid var(--rfa-line);
        border-radius:8px;
        transition:
          border-color 140ms var(--rfa-ease),
          box-shadow 140ms var(--rfa-ease);
      }

      .rf-auth-card .rf-auth-field > div:focus-within,
      .rf-auth-card label.rf-auth-input > div:focus-within{
        border-color:rgba(70,72,212,.55);
        box-shadow:0 0 0 3px rgba(70,72,212,.07);
      }

      .rf-auth-card .rf-auth-field input,
      .rf-auth-card label.rf-auth-input input{
        min-width:0;
        width:100%;
        height:42px;
        padding:0;
        color:var(--rfa-text);
        background:transparent;
        border:0;
        outline:0;
        box-shadow:none;
        font-size:9px;
      }

      .rf-auth-card .rf-password-toggle{
        min-width:39px;
        height:27px;
        padding:0 7px;
        color:var(--rfa-primary);
        background:var(--rfa-primary-soft);
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:6px;
        font-weight:750;
      }

      .rf-auth-card .rf-auth-row{
        display:flex;
        align-items:center;
        justify-content:flex-end;
        gap:8px;
      }

      .rf-auth-card .rf-auth-row a{
        color:var(--rfa-primary);
        font-size:7px;
        font-weight:700;
        text-decoration:none;
      }

      .rf-auth-card .rf-auth-submit{
        min-height:44px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:7px;
        width:100%;
        padding:9px 13px;
        color:#fff;
        background:linear-gradient(135deg,#4a4cd8,#4143cb);
        border:1px solid #4143c6;
        border-radius:8px;
        box-shadow:0 8px 18px rgba(70,72,212,.18);
        cursor:pointer;
        font-size:8px;
        font-weight:750;
        transition:
          transform 140ms var(--rfa-ease),
          background 140ms var(--rfa-ease),
          box-shadow 140ms var(--rfa-ease);
      }

      .rf-auth-card .rf-auth-submit:hover:not(:disabled){
        transform:translateY(-1px);
        background:linear-gradient(135deg,#4143cb,#3739bb);
        box-shadow:0 11px 24px rgba(70,72,212,.22);
      }

      .rf-auth-card .rf-auth-submit:disabled{
        opacity:.55;
        cursor:not-allowed;
      }

      .rf-auth-card .rf-auth-back-btn{
        min-height:40px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:8px 10px;
        color:var(--rfa-text2);
        background:#fff;
        border:1px solid var(--rfa-line);
        border-radius:8px;
        cursor:pointer;
        font-size:7px;
        font-weight:700;
      }

      .rf-auth-card .rf-auth-form-actions{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        margin-top:2px;
      }

      .rf-auth-card .rf-auth-form-actions .rf-auth-submit{
        width:auto;
        min-width:160px;
      }

      .rf-auth-card .rf-auth-divider{
        position:relative;
        display:flex;
        align-items:center;
        justify-content:center;
        min-height:42px;
      }

      .rf-auth-card .rf-auth-divider::before{
        content:"";
        position:absolute;
        left:0;
        right:0;
        top:50%;
        height:1px;
        background:var(--rfa-line);
      }

      .rf-auth-card .rf-auth-divider > span{
        position:relative;
        z-index:1;
        padding:0 9px;
        color:#8b8c95;
        background:#fff;
        font-size:6px;
        font-weight:650;
        letter-spacing:.05em;
        text-transform:uppercase;
      }

      .rf-auth-card .rf-auth-type-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:9px;
      }

      .rf-auth-card .rf-auth-type-card{
        position:relative;
        min-height:150px;
        display:grid;
        align-content:start;
        gap:8px;
        padding:14px;
        color:inherit;
        background:#fff;
        border:1px solid var(--rfa-line);
        border-radius:10px;
        text-align:left;
        cursor:pointer;
        transition:
          transform 140ms var(--rfa-ease),
          border-color 140ms var(--rfa-ease),
          box-shadow 140ms var(--rfa-ease),
          background 140ms var(--rfa-ease);
      }

      .rf-auth-card .rf-auth-type-card:hover{
        transform:translateY(-1px);
        border-color:#cfd0fb;
        box-shadow:0 7px 18px rgba(25,28,29,.045);
      }

      .rf-auth-card .rf-auth-type-card.active{
        background:#fbfbff;
        border-color:var(--rfa-primary);
        box-shadow:0 0 0 1px var(--rfa-primary);
      }

      .rf-auth-card .rf-auth-type-icon{
        width:38px;
        height:38px;
        display:grid;
        place-items:center;
        color:var(--rfa-primary);
        background:var(--rfa-primary-soft);
        border-radius:9px;
      }

      .rf-auth-card .rf-auth-type-card > div{
        display:grid;
        gap:3px;
      }

      .rf-auth-card .rf-auth-type-card b{
        font-size:8px;
      }

      .rf-auth-card .rf-auth-type-card small{
        color:var(--rfa-muted);
        font-size:6.5px;
        line-height:11px;
      }

      .rf-auth-card .rf-auth-type-card > i{
        position:absolute;
        right:9px;
        top:9px;
        width:22px;
        height:22px;
        display:grid;
        place-items:center;
        color:#fff;
        background:var(--rfa-primary);
        border-radius:50%;
      }

      .rf-auth-card .rf-auth-stepbar{
        display:grid;
        grid-template-columns:auto minmax(30px,1fr) auto;
        align-items:center;
        gap:8px;
        margin-bottom:5px;
      }

      .rf-auth-card .rf-auth-stepbar > span{
        display:flex;
        align-items:center;
        gap:6px;
        color:#9a9ba3;
        font-size:6px;
        font-weight:700;
      }

      .rf-auth-card .rf-auth-stepbar > span b{
        width:21px;
        height:21px;
        display:grid;
        place-items:center;
        color:#777984;
        background:#eceeef;
        border-radius:50%;
        font-size:6px;
      }

      .rf-auth-card .rf-auth-stepbar > span.active{
        color:var(--rfa-primary);
      }

      .rf-auth-card .rf-auth-stepbar > span.active b{
        color:#fff;
        background:var(--rfa-primary);
      }

      .rf-auth-card .rf-auth-stepbar > i{
        height:1px;
        background:#e3e5e7;
      }

      .rf-auth-card .rf-auth-selected-note{
        display:flex;
        align-items:flex-start;
        gap:8px;
        padding:10px;
        color:var(--rfa-primary);
        background:var(--rfa-primary-soft);
        border-radius:8px;
      }

      .rf-auth-card .rf-auth-selected-note > span{
        width:29px;
        height:29px;
        display:grid;
        place-items:center;
        flex:0 0 29px;
        background:#fff;
        border-radius:7px;
      }

      .rf-auth-card .rf-auth-selected-note > div{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .rf-auth-card .rf-auth-selected-note b{
        color:var(--rfa-text);
        font-size:7px;
      }

      .rf-auth-card .rf-auth-selected-note small{
        color:var(--rfa-text2);
        font-size:6px;
        line-height:10px;
      }

      .rf-auth-submit:focus-visible,
      .rf-auth-back-btn:focus-visible,
      .rf-auth-type-card:focus-visible,
      .rf-password-toggle:focus-visible,
      .rf-auth-footer a:focus-visible,
      .rf-auth-row a:focus-visible,
      .rf-auth-brand:focus-visible{
        outline:3px solid rgba(70,72,212,.17);
        outline-offset:3px;
      }

      @media(max-width:1080px){
        .rf-auth-shell{
          grid-template-columns:minmax(0,.95fr) minmax(430px,1.05fr);
        }

        .rf-auth-hero{
          padding:30px;
        }

        .rf-auth-proof{
          grid-template-columns:1fr;
          gap:6px;
        }

        .rf-auth-proof article{
          min-height:57px;
          grid-template-columns:27px minmax(0,1fr);
        }

        .rf-auth-proof small{
          max-width:300px;
        }
      }

      @media(max-width:900px){
        .rf-auth-page{
          overflow:auto;
          padding:18px;
        }

        .rf-auth-shell{
          width:min(680px,100%);
          min-height:0;
          grid-template-columns:1fr;
        }

        .rf-auth-hero{
          min-height:290px;
          padding:26px 28px;
        }

        .rf-auth-copy{
          margin-top:28px;
        }

        .rf-auth-copy h1{
          max-width:560px;
          font-size:36px;
        }

        .rf-auth-copy p{
          max-width:560px;
        }

        .rf-auth-proof{
          display:none;
        }

        .rf-auth-hero-footer{
          margin-top:auto;
        }

        .rf-auth-panel{
          min-height:0;
          padding:35px 30px;
        }

        /*
         * Login.jsx passes its optional product visualization as a second
         * AuthLayout child. Hide large shell decorations once the layout
         * collapses to a single column.
         */
        .rf-auth-shell > .rfl-hero-enhancement{
          display:none!important;
        }
      }

      @media(max-width:620px){
        .rf-auth-page{
          display:block;
          min-height:100svh;
          padding:0;
          background:#fff;
        }

        .rf-auth-shell{
          width:100%;
          min-height:100svh;
          display:block;
          border:0;
          border-radius:0;
          box-shadow:none;
        }

        .rf-auth-hero{
          min-height:76px;
          display:flex;
          justify-content:center;
          padding:16px 18px;
          background:#2e3132;
        }

        .rf-auth-hero::before,
        .rf-auth-hero::after{
          display:none;
        }

        .rf-auth-hero-top{
          width:100%;
        }

        .rf-auth-brand{
          gap:7px;
        }

        .rf-auth-brand b{
          font-size:14px;
        }

        .rf-auth-secure-pill{
          min-height:26px;
          font-size:5.5px;
        }

        .rf-auth-copy,
        .rf-auth-proof,
        .rf-auth-hero-footer{
          display:none;
        }

        .rf-auth-panel{
          min-height:calc(100svh - 76px);
          justify-content:flex-start;
          padding:26px 18px 34px;
        }

        .rf-auth-card{
          max-width:500px;
        }

        .rf-auth-footer{
          max-width:500px;
        }

        .rf-auth-card .rf-auth-type-grid{
          grid-template-columns:1fr;
        }

        .rf-auth-card .rf-auth-type-card{
          min-height:105px;
        }
      }

      @media(max-width:430px){
        .rf-auth-secure-pill{
          display:none;
        }

        .rf-auth-card .rf-auth-form-actions{
          align-items:stretch;
          flex-direction:column-reverse;
        }

        .rf-auth-card .rf-auth-form-actions .rf-auth-submit,
        .rf-auth-card .rf-auth-form-actions .rf-auth-back-btn{
          width:100%;
        }
      }



      /* Premium auth experience */
      .rf-auth-page{position:relative;isolation:isolate;background:#0b0d12!important;overflow:hidden!important}
      .rf-auth-grid-bg{position:fixed;z-index:-4;inset:0;opacity:.35;background-image:linear-gradient(rgba(255,255,255,.028) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.028) 1px,transparent 1px);background-size:56px 56px;mask-image:radial-gradient(circle at 50% 45%,#000 0 35%,transparent 80%);pointer-events:none}
      .rf-auth-ambient{position:fixed;z-index:-3;width:48vw;aspect-ratio:1;border-radius:50%;filter:blur(90px);pointer-events:none;opacity:.38;animation:rfaAmbient 12s ease-in-out infinite alternate}
      .rf-auth-ambient-a{left:-18vw;top:-20vh;background:#4f55ff}
      .rf-auth-ambient-b{right:-18vw;bottom:-24vh;background:#7843d6;animation-delay:-4s}
      @keyframes rfaAmbient{from{transform:translate3d(-2%,0,0) scale(.94)}to{transform:translate3d(5%,4%,0) scale(1.08)}}
      .rf-auth-shell{position:relative;z-index:2;overflow:hidden;border:1px solid rgba(255,255,255,.11)!important;box-shadow:0 44px 120px rgba(0,0,0,.48),inset 0 1px 0 rgba(255,255,255,.08)!important;background:rgba(17,19,25,.84)!important;backdrop-filter:blur(26px) saturate(135%)}
      .rf-auth-hero{position:relative;overflow:hidden;background:linear-gradient(145deg,rgba(42,45,56,.98),rgba(22,24,31,.98) 62%,rgba(26,19,40,.98))!important}
      .rf-auth-hero::after{content:"";position:absolute;inset:auto -35% -45% 15%;height:70%;background:radial-gradient(circle,rgba(91,94,240,.28),transparent 64%);pointer-events:none}
      .rf-auth-hero-orbit{position:absolute;right:-90px;top:44%;width:260px;height:260px;border:1px solid rgba(168,170,255,.14);border-radius:50%;opacity:.8;pointer-events:none;animation:rfaOrbitSpin 18s linear infinite}.rf-auth-hero-orbit::before,.rf-auth-hero-orbit::after{content:"";position:absolute;inset:34px;border:1px solid rgba(255,255,255,.08);border-radius:50%}.rf-auth-hero-orbit::after{inset:76px}.rf-auth-hero-orbit i{position:absolute;width:8px;height:8px;border-radius:50%;background:#a7a9ff;box-shadow:0 0 20px rgba(167,169,255,.8)}.rf-auth-hero-orbit i:nth-child(1){top:20px;left:74px}.rf-auth-hero-orbit i:nth-child(2){right:22px;bottom:82px}.rf-auth-hero-orbit i:nth-child(3){left:48px;bottom:18px;background:#78d7ff}
      @keyframes rfaOrbitSpin{to{transform:rotate(360deg)}}
      .rf-auth-brand,.rf-auth-copy,.rf-auth-proof,.rf-auth-hero-footer{position:relative;z-index:2}
      .rf-auth-panel{background:linear-gradient(180deg,rgba(250,251,253,.985),rgba(246,247,250,.98))!important}
      .rf-auth-card{border:1px solid rgba(31,34,43,.08)!important;box-shadow:0 24px 65px rgba(16,18,24,.11)!important;background:rgba(255,255,255,.94)!important;backdrop-filter:blur(16px)}
      .rf-auth-secure-pill{box-shadow:inset 0 1px 0 rgba(255,255,255,.14)}
      @media(max-width:760px){.rf-auth-page{background:linear-gradient(180deg,#0c0e13 0 17%,#f6f7fa 17% 100%)!important}.rf-auth-shell{border-radius:20px!important}.rf-auth-hero-orbit{display:none}}

            @media(prefers-reduced-motion:reduce){
        .rf-auth-page,
        .rf-auth-hero,
        .rf-auth-card,
        .rf-auth-hero::after{
          animation:none!important;
        }

        .rf-auth-page *,
        .rf-auth-page *::before,
        .rf-auth-page *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
