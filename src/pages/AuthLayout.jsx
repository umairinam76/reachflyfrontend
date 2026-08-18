import { Children } from "react";
import { Link } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";

import BrandLogo from "../components/BrandLogo";

import {
  Shield,
  Sparkles,
  Target,
  Phone,
  Workflow,
} from "../components/icons";

import "../styles.css";

const AUTH_VIDEO =
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260601_110537_3a579fa0-7bbc-4d94-9d25-0e816c7840f5.mp4";

const SIGNALS = [
  {
    icon: Target,
    label: "Discover",
    text: "Find the right market",
  },
  {
    icon: Phone,
    label: "Converse",
    text: "AI Voice with context",
  },
  {
    icon: Workflow,
    label: "Advance",
    text: "Keep every next step connected",
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

  return (
    <>
      <AuthLayoutStyles />

      <motion.main
        className="rf15-auth-page rf16-auth-page"
        initial={
          reduceMotion
            ? false
            : {
                opacity: 0,
              }
        }
        animate={{
          opacity: 1,
        }}
        transition={{
          duration: reduceMotion ? 0 : 0.35,
        }}
      >
        <motion.section
          className="rf16-auth-shell"
          initial={
            reduceMotion
              ? false
              : {
                  opacity: 0,
                  y: 18,
                  scale: 0.992,
                }
          }
          animate={{
            opacity: 1,
            y: 0,
            scale: 1,
          }}
          transition={{
            duration: reduceMotion ? 0 : 0.62,
            ease: [0.2, 0.8, 0.2, 1],
          }}
        >
          {/* =====================================================
              LEFT — MARKETING STYLE VISUAL
          ===================================================== */}

          <aside className="rf16-auth-visual">
            <div
              className="rf16-auth-video-layer"
              aria-hidden="true"
            >
              <video
                className="rf16-auth-video"
                src={AUTH_VIDEO}
                muted
                playsInline
                autoPlay
                loop
                preload="auto"
              />

              <span className="rf16-auth-video-wash" />
              <span className="rf16-auth-video-soft" />
              <span className="rf16-auth-video-grain" />
            </div>

            {/* ===================================================
                TOP
            =================================================== */}

            <div className="rf16-auth-top">
              <Link
                className="rf16-auth-brand"
                to="/"
                aria-label="ReachFlyAI home"
              >
                <BrandLogo
                  size={44}
                  alt="ReachFlyAI"
                  showName
                />
              </Link>

              <span className="rf16-auth-secure">
                <Shield size={13} />

                <span>
                  Secure workspace
                </span>
              </span>
            </div>

            {/* ===================================================
                COPY
            =================================================== */}

            <motion.div
              className="rf16-auth-copy"
              initial={
                reduceMotion
                  ? false
                  : {
                      opacity: 0,
                      y: 24,
                    }
              }
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                delay: 0.08,
                duration: reduceMotion ? 0 : 0.58,
                ease: [0.2, 0.8, 0.2, 1],
              }}
            >
              <span className="rf16-auth-eyebrow">
                <Sparkles size={13} />

                {eyebrow}
              </span>

              <h1>
                {title}
              </h1>

              <p>
                {text}
              </p>
            </motion.div>

            {/* ===================================================
                SIGNALS
            =================================================== */}

            <div className="rf16-auth-signals">
              {SIGNALS.map(
                (
                  {
                    icon: Icon,
                    label,
                    text: signalText,
                  },
                  index
                ) => (
                  <motion.article
                    key={label}
                    initial={
                      reduceMotion
                        ? false
                        : {
                            opacity: 0,
                            y: 12,
                          }
                    }
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    transition={{
                      delay:
                        0.16 +
                        index * 0.07,
                      duration:
                        reduceMotion
                          ? 0
                          : 0.46,
                    }}
                  >
                    <span className="rf16-auth-signal-icon">
                      <Icon size={15} />
                    </span>

                    <div>
                      <strong>
                        {label}
                      </strong>

                      <small>
                        {signalText}
                      </small>
                    </div>
                  </motion.article>
                )
              )}
            </div>

            {/* ===================================================
                FLOW
            =================================================== */}

            <motion.div
              className="rf16-auth-flow"
              initial={
                reduceMotion
                  ? false
                  : {
                      opacity: 0,
                    }
              }
              animate={{
                opacity: 1,
              }}
              transition={{
                delay: 0.38,
                duration: 0.5,
              }}
              aria-hidden="true"
            >
              <span>
                Market
              </span>

              <i />

              <span>
                Context
              </span>

              <i />

              <span>
                Voice
              </span>

              <i />

              <span>
                Meeting
              </span>
            </motion.div>
          </aside>

          {/* =====================================================
              RIGHT — AUTH FORM
          ===================================================== */}

          <section className="rf16-auth-panel">
            <motion.div
              className="rf16-auth-card"
              initial={
                reduceMotion
                  ? false
                  : {
                      opacity: 0,
                      x: 24,
                    }
              }
              animate={{
                opacity: 1,
                x: 0,
              }}
              transition={{
                delay: 0.08,
                duration: reduceMotion
                  ? 0
                  : 0.54,
                ease: [0.2, 0.8, 0.2, 1],
              }}
            >
              {primaryContent}
            </motion.div>

            {footer ? (
              <motion.div
                className="rf16-auth-footer"
                initial={
                  reduceMotion
                    ? false
                    : {
                        opacity: 0,
                      }
                }
                animate={{
                  opacity: 1,
                }}
                transition={{
                  delay: 0.28,
                }}
              >
                {footer}
              </motion.div>
            ) : null}
          </section>
        </motion.section>
      </motion.main>
    </>
  );
}

function AuthLayoutStyles() {
  return (
    <style>{`
      /* ==========================================================
         ReachFly Auth V16
         Matches the light, video-backed Marketing V14 visual system.
         ========================================================== */

      .rf15-auth-page.rf16-auth-page {
        --rf16-ink: #151817;
        --rf16-body: #566159;
        --rf16-muted: #748077;

        --rf16-green: #1c2e1e;
        --rf16-green-hover: #273d29;

        --rf16-soft: #f5f7f3;
        --rf16-soft-2: #fafbf9;

        --rf16-line: #e4e9e3;
        --rf16-line-strong: #d4ddd4;

        --rf16-white: #ffffff;

        position: relative !important;

        width: 100% !important;
        min-width: 320px !important;
        min-height: 100svh !important;

        display: grid !important;
        place-items: center !important;

        padding:
          clamp(14px, 2vw, 28px) !important;

        overflow-x: hidden !important;
        overflow-y: auto !important;

        isolation: isolate !important;

        color:
          var(--rf16-ink) !important;

        background:
          #f5f6f3 !important;

        font-family:
          Inter,
          "Plus Jakarta Sans",
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif !important;

        -webkit-font-smoothing:
          antialiased;

        text-rendering:
          optimizeLegibility;
      }

      .rf16-auth-page *,
      .rf16-auth-page *::before,
      .rf16-auth-page *::after {
        box-sizing: border-box;
      }

      .rf16-auth-page a {
        text-decoration: none;
      }


      /* ==========================================================
         SHELL
         ========================================================== */

      .rf16-auth-shell {
        position: relative;

        width:
          min(
            1420px,
            calc(100vw - 42px)
          );

        min-height:
          min(
            850px,
            calc(100svh - 42px)
          );

        display: grid;

        grid-template-columns:
          minmax(0, 1.08fr)
          minmax(430px, .92fr);

        overflow: hidden;

        border:
          1px solid rgba(
            28,
            46,
            30,
            .09
          );

        border-radius:
          30px;

        background:
          #fff;

        box-shadow:
          0 34px 90px
            rgba(
              29,
              39,
              31,
              .09
            ),
          0 8px 24px
            rgba(
              29,
              39,
              31,
              .04
            );
      }


      /* ==========================================================
         VISUAL SIDE
         ========================================================== */

      .rf16-auth-visual {
        position: relative;

        min-width: 0;
        min-height: 100%;

        display: flex;
        flex-direction: column;

        padding:
          clamp(
            28px,
            3.2vw,
            52px
          );

        overflow: hidden;

        isolation: isolate;

        background:
          #f4f5f1;

        border-right:
          1px solid
          rgba(
            28,
            46,
            30,
            .07
          );
      }

      .rf16-auth-video-layer {
        position: absolute;
        inset: 0;

        z-index: -3;

        overflow: hidden;

        pointer-events: none;

        background:
          #f5f5f1;
      }

      .rf16-auth-video {
        position: absolute;

        inset: 0;

        width: 100%;
        height: 100%;

        display: block;

        object-fit: cover;

        /*
         * Similar composition to the marketing hero.
         * Keeps the character/product visual on the right.
         */
        object-position:
          72% 50%;

        transform:
          scale(1.02);

        filter:
          saturate(.95)
          contrast(.98);
      }

      .rf16-auth-video-wash,
      .rf16-auth-video-soft,
      .rf16-auth-video-grain {
        position: absolute;
        inset: 0;

        pointer-events: none;
      }

      .rf16-auth-video-wash {
        background:
          linear-gradient(
            90deg,
            rgba(
              255,
              255,
              255,
              .98
            ) 0%,
            rgba(
              255,
              255,
              255,
              .95
            ) 25%,
            rgba(
              255,
              255,
              255,
              .80
            ) 46%,
            rgba(
              255,
              255,
              255,
              .26
            ) 69%,
            rgba(
              255,
              255,
              255,
              .03
            ) 100%
          );
      }

      .rf16-auth-video-soft {
        background:
          linear-gradient(
            180deg,
            rgba(
              255,
              255,
              255,
              .25
            ),
            transparent 30%,
            transparent 64%,
            rgba(
              246,
              248,
              244,
              .60
            )
          ),
          radial-gradient(
            circle at 18% 42%,
            rgba(
              255,
              255,
              255,
              .72
            ),
            transparent 44%
          );
      }

      .rf16-auth-video-grain {
        opacity: .032;

        mix-blend-mode:
          multiply;

        background-image:
          url("data:image/svg+xml,%3Csvg viewBox='0 0 180 180' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='.45'/%3E%3C/svg%3E");
      }


      /* ==========================================================
         TOP BRAND
         ========================================================== */

      .rf16-auth-top {
        position: relative;

        z-index: 5;

        display: flex;

        align-items: center;
        justify-content: space-between;

        gap: 18px;
      }

      .rf16-auth-brand {
        display: inline-flex;

        align-items: center;

        width: max-content;

        color:
          #121514 !important;
      }

      /*
       * Important:
       * BrandLogo itself now renders:
       *
       * [logo] ReachFly AI
       *
       * No duplicate ReachFly/AI text exists here.
       */
      .rf16-auth-brand .rf-logo-v8 {
        color:
          #121514 !important;
      }

      .rf16-auth-brand .rf-logo-v8__ai {
        color:
          #596153 !important;
      }

      .rf16-auth-secure {
        min-height: 34px;

        display: inline-flex;
        align-items: center;

        gap: 7px;

        padding:
          0 12px;

        border:
          1px solid
          rgba(
            28,
            46,
            30,
            .11
          );

        border-radius:
          999px;

        color:
          #415043;

        background:
          rgba(
            255,
            255,
            255,
            .60
          );

        backdrop-filter:
          blur(16px);

        -webkit-backdrop-filter:
          blur(16px);

        font-size:
          11px;

        font-weight:
          600;

        box-shadow:
          0 7px 24px
          rgba(
            38,
            47,
            39,
            .04
          );
      }


      /* ==========================================================
         COPY
         ========================================================== */

      .rf16-auth-copy {
        position: relative;

        z-index: 4;

        width:
          min(
            610px,
            86%
          );

        margin-top:
          clamp(
            110px,
            16vh,
            180px
          );
      }

      .rf16-auth-eyebrow {
        width: max-content;

        display: inline-flex;
        align-items: center;

        gap: 7px;

        padding:
          8px 12px;

        margin-bottom:
          20px;

        border:
          1px solid
          rgba(
            28,
            46,
            30,
            .10
          );

        border-radius:
          999px;

        color:
          #4e5d50;

        background:
          rgba(
            255,
            255,
            255,
            .58
          );

        backdrop-filter:
          blur(12px);

        -webkit-backdrop-filter:
          blur(12px);

        font-size:
          10px;

        font-weight:
          650;

        letter-spacing:
          .02em;
      }

      .rf16-auth-copy h1 {
        max-width:
          620px;

        margin:
          0;

        color:
          #121514 !important;

        font-size:
          clamp(
            48px,
            4.7vw,
            74px
          );

        font-weight:
          500;

        line-height:
          .99;

        letter-spacing:
          -.055em;
      }

      .rf16-auth-copy p {
        max-width:
          520px;

        margin:
          22px 0 0;

        color:
          #556058 !important;

        font-size:
          clamp(
            14px,
            1vw,
            16px
          );

        font-weight:
          400;

        line-height:
          1.7;
      }


      /* ==========================================================
         SIGNAL CARDS
         ========================================================== */

      .rf16-auth-signals {
        position: relative;

        z-index: 4;

        width:
          min(
            650px,
            100%
          );

        display: grid;

        grid-template-columns:
          repeat(
            3,
            minmax(
              0,
              1fr
            )
          );

        gap: 8px;

        margin-top: auto;

        padding-top:
          46px;
      }

      .rf16-auth-signals article {
        min-width: 0;

        display: flex;

        align-items: center;

        gap: 10px;

        padding:
          11px;

        border:
          1px solid
          rgba(
            28,
            46,
            30,
            .08
          );

        border-radius:
          14px;

        background:
          rgba(
            255,
            255,
            255,
            .56
          );

        backdrop-filter:
          blur(18px);

        -webkit-backdrop-filter:
          blur(18px);

        box-shadow:
          0 8px 28px
          rgba(
            25,
            35,
            27,
            .035
          );
      }

      .rf16-auth-signal-icon {
        width: 31px;
        height: 31px;

        flex:
          0 0 31px;

        display: grid;

        place-items: center;

        border-radius:
          10px;

        color:
          #ffffff;

        background:
          #1c2e1e;
      }

      .rf16-auth-signals strong {
        display: block;

        color:
          #1b201c;

        font-size:
          10px;

        font-weight:
          700;

        line-height:
          1.2;
      }

      .rf16-auth-signals small {
        display: block;

        margin-top:
          2px;

        color:
          #69736b;

        font-size:
          8px;

        line-height:
          1.35;
      }


      /* ==========================================================
         FLOW
         ========================================================== */

      .rf16-auth-flow {
        position: relative;

        z-index: 4;

        display: flex;
        align-items: center;

        gap: 9px;

        margin-top:
          15px;

        color:
          #727d74;

        font-size:
          8px;

        font-weight:
          650;

        letter-spacing:
          .04em;

        text-transform:
          uppercase;
      }

      .rf16-auth-flow i {
        width: 20px;
        height: 1px;

        display: block;

        background:
          rgba(
            28,
            46,
            30,
            .21
          );
      }


      /* ==========================================================
         RIGHT PANEL
         ========================================================== */

      .rf16-auth-panel {
        position: relative;

        min-width: 0;

        display: flex;
        flex-direction: column;

        justify-content: center;

        padding:
          clamp(
            34px,
            4vw,
            64px
          );

        overflow-y:
          auto;

        background:
          rgba(
            253,
            254,
            252,
            .98
          );

        color:
          var(--rf16-ink);
      }

      .rf16-auth-card {
        width:
          min(
            100%,
            520px
          );

        margin:
          auto;

        color:
          var(--rf16-ink);
      }

      .rf16-auth-footer {
        width:
          min(
            100%,
            520px
          );

        margin:
          22px auto 0;

        text-align:
          center;

        color:
          #768078 !important;

        font-size:
          11px;

        line-height:
          1.5;
      }

      .rf16-auth-footer a {
        color:
          #1c2e1e !important;

        font-weight:
          700;
      }

      .rf16-auth-footer a:hover {
        text-decoration:
          underline;
      }


      /* ==========================================================
         SHARED FORM THEME
         Login / Signup / Forgot / Reset
         ========================================================== */

      .rf15-auth-page.rf16-auth-page
        .rf11-auth-form,
      .rf15-auth-page.rf16-auth-page
        .rf-auth-form,
      .rf15-auth-page.rf16-auth-page
        .rf11-signup-v7,
      .rf15-auth-page.rf16-auth-page
        .rf-forgot-v7,
      .rf15-auth-page.rf16-auth-page
        .rf-reset-v7 {
        color:
          #151817 !important;

        background:
          transparent !important;
      }


      /* ==========================================================
         HEADINGS
         ========================================================== */

      .rf15-auth-page.rf16-auth-page
        .rf11-auth-card-head h2,
      .rf15-auth-page.rf16-auth-page
        .rf-auth-card-head h2,
      .rf15-auth-page.rf16-auth-page
        .rff-success-state h2,
      .rf15-auth-page.rf16-auth-page
        .rfr-success h2 {
        color:
          #151817 !important;

        font-size:
          clamp(
            29px,
            2.4vw,
            38px
          ) !important;

        font-weight:
          600 !important;

        line-height:
          1.05 !important;

        letter-spacing:
          -.045em !important;
      }

      .rf15-auth-page.rf16-auth-page
        .rf11-auth-card-head p,
      .rf15-auth-page.rf16-auth-page
        .rf-auth-card-head p,
      .rf15-auth-page.rf16-auth-page
        .rff-card-head p,
      .rf15-auth-page.rf16-auth-page
        .rfr-card-head p,
      .rf15-auth-page.rf16-auth-page
        .rff-success-state > p,
      .rf15-auth-page.rf16-auth-page
        .rfr-success > p {
        color:
          #687269 !important;

        font-size:
          12px !important;

        line-height:
          1.65 !important;
      }


      /* ==========================================================
         EYEBROWS
         ========================================================== */

      .rf15-auth-page.rf16-auth-page
        .rf11-login-card-eyebrow,
      .rf15-auth-page.rf16-auth-page
        .rf11-signup-card-eyebrow,
      .rf15-auth-page.rf16-auth-page
        .rff-card-eyebrow,
      .rf15-auth-page.rf16-auth-page
        .rfr-eyebrow {
        color:
          #617064 !important;

        background:
          #f3f6f1 !important;

        border:
          1px solid
          #e4eae3 !important;
      }


      /* ==========================================================
         INPUT LABELS
         ========================================================== */

      .rf15-auth-page.rf16-auth-page
        label,
      .rf15-auth-page.rf16-auth-page
        .rf11-login-field-label,
      .rf15-auth-page.rf16-auth-page
        .rf11-signup-field > span,
      .rf15-auth-page.rf16-auth-page
        .rff-field > span,
      .rf15-auth-page.rf16-auth-page
        .rfr-field > span {
        color:
          #404943 !important;

        font-weight:
          650 !important;
      }


      /* ==========================================================
         INPUTS
         ========================================================== */

      .rf15-auth-page.rf16-auth-page
        input,
      .rf15-auth-page.rf16-auth-page
        select,
      .rf15-auth-page.rf16-auth-page
        textarea {
        color:
          #171b18 !important;

        background:
          #ffffff !important;

        border-color:
          #e0e6df !important;

        box-shadow:
          none !important;
      }

      .rf15-auth-page.rf16-auth-page
        input::placeholder,
      .rf15-auth-page.rf16-auth-page
        textarea::placeholder {
        color:
          #a1aaa3 !important;
      }

      .rf15-auth-page.rf16-auth-page
        input:focus,
      .rf15-auth-page.rf16-auth-page
        select:focus,
      .rf15-auth-page.rf16-auth-page
        textarea:focus {
        outline:
          none !important;

        border-color:
          rgba(
            28,
            46,
            30,
            .42
          ) !important;

        box-shadow:
          0 0 0 4px
          rgba(
            28,
            46,
            30,
            .065
          ) !important;
      }


      /* ==========================================================
         PRIMARY BUTTONS
         ========================================================== */

      .rf15-auth-page.rf16-auth-page
        .rf11-auth-submit,
      .rf15-auth-page.rf16-auth-page
        .rf-auth-submit {
        color:
          #ffffff !important;

        background:
          #1c2e1e !important;

        border:
          1px solid
          #1c2e1e !important;

        box-shadow:
          0 10px 28px
          rgba(
            28,
            46,
            30,
            .14
          ) !important;

        transition:
          transform .2s ease,
          background .2s ease,
          box-shadow .2s ease !important;
      }

      .rf15-auth-page.rf16-auth-page
        .rf11-auth-submit:not(:disabled):hover,
      .rf15-auth-page.rf16-auth-page
        .rf-auth-submit:not(:disabled):hover {
        transform:
          translateY(-1px) !important;

        background:
          #273d29 !important;

        box-shadow:
          0 14px 34px
          rgba(
            28,
            46,
            30,
            .18
          ) !important;
      }

      .rf15-auth-page.rf16-auth-page
        .rf11-auth-submit:disabled,
      .rf15-auth-page.rf16-auth-page
        .rf-auth-submit:disabled {
        color:
          #9aa39b !important;

        background:
          #edf0eb !important;

        border-color:
          #e1e5df !important;

        box-shadow:
          none !important;

        cursor:
          not-allowed !important;
      }


      /* ==========================================================
         SECONDARY BUTTONS
         ========================================================== */

      .rf15-auth-page.rf16-auth-page
        .rf11-auth-back-btn,
      .rf15-auth-page.rf16-auth-page
        .rff-secondary-action {
        color:
          #415044 !important;

        background:
          #ffffff !important;

        border:
          1px solid
          #e0e6df !important;
      }


      /* ==========================================================
         LINKS
         ========================================================== */

      .rf15-auth-page.rf16-auth-page
        .rf11-auth-form a,
      .rf15-auth-page.rf16-auth-page
        .rf-auth-form a {
        color:
          #344d38 !important;
      }


      /* ==========================================================
         DIVIDER
         ========================================================== */

      .rf15-auth-page.rf16-auth-page
        .rf11-auth-divider,
      .rf15-auth-page.rf16-auth-page
        .rf-auth-divider {
        color:
          #8b948d !important;
      }

      .rf15-auth-page.rf16-auth-page
        .rf11-auth-divider::before,
      .rf15-auth-page.rf16-auth-page
        .rf11-auth-divider::after,
      .rf15-auth-page.rf16-auth-page
        .rf-auth-divider::before,
      .rf15-auth-page.rf16-auth-page
        .rf-auth-divider::after {
        background:
          #e7ebe6 !important;
      }


      /* ==========================================================
         SIGNUP WORKSPACE CARDS
         ========================================================== */

      .rf15-auth-page.rf16-auth-page
        .rf11-signup-workspace-card {
        color:
          #171b18 !important;

        background:
          #ffffff !important;

        border:
          1px solid
          #e1e6e0 !important;

        box-shadow:
          0 8px 25px
          rgba(
            26,
            39,
            28,
            .035
          ) !important;
      }

      .rf15-auth-page.rf16-auth-page
        .rf11-signup-workspace-card:hover {
        transform:
          translateY(-2px) !important;

        border-color:
          #cdd7ce !important;

        box-shadow:
          0 14px 36px
          rgba(
            26,
            39,
            28,
            .07
          ) !important;
      }

      .rf15-auth-page.rf16-auth-page
        .rf11-signup-workspace-card.active {
        color:
          #17231a !important;

        background:
          #f3f7f1 !important;

        border-color:
          #8fa290 !important;

        box-shadow:
          0 0 0 3px
          rgba(
            28,
            46,
            30,
            .06
          ) !important;
      }

      .rf15-auth-page.rf16-auth-page
        .rf11-signup-workspace-card b {
        color:
          #171b18 !important;
      }

      .rf15-auth-page.rf16-auth-page
        .rf11-signup-workspace-card small {
        color:
          #6f7971 !important;
      }


      /* ==========================================================
         INFO / SECURITY SURFACES
         ========================================================== */

      .rf15-auth-page.rf16-auth-page
        .rf11-signup-info-note,
      .rf15-auth-page.rf16-auth-page
        .rf11-signup-privacy-note,
      .rf15-auth-page.rf16-auth-page
        .rf11-signup-security-note,
      .rf15-auth-page.rf16-auth-page
        .rf11-signup-selected-workspace,
      .rf15-auth-page.rf16-auth-page
        .rff-recovery-visual,
      .rf15-auth-page.rf16-auth-page
        .rff-security-note,
      .rf15-auth-page.rf16-auth-page
        .rfr-reset-visual,
      .rf15-auth-page.rf16-auth-page
        .rfr-security-note,
      .rf15-auth-page.rf16-auth-page
        .rfr-security-card {
        color:
          #415044 !important;

        background:
          #f7f9f6 !important;

        border:
          1px solid
          #e3e8e2 !important;

        box-shadow:
          none !important;
      }

      .rf15-auth-page.rf16-auth-page
        .rf11-signup-info-note b,
      .rf15-auth-page.rf16-auth-page
        .rf11-signup-selected-workspace strong,
      .rf15-auth-page.rf16-auth-page
        .rff-recovery-visual strong,
      .rf15-auth-page.rf16-auth-page
        .rfr-reset-visual strong,
      .rf15-auth-page.rf16-auth-page
        .rfr-security-card strong {
        color:
          #202721 !important;
      }

      .rf15-auth-page.rf16-auth-page
        .rf11-signup-info-note p,
      .rf15-auth-page.rf16-auth-page
        .rf11-signup-info-note small,
      .rf15-auth-page.rf16-auth-page
        .rff-recovery-visual p,
      .rf15-auth-page.rf16-auth-page
        .rfr-reset-visual p,
      .rf15-auth-page.rf16-auth-page
        .rfr-security-card small,
      .rf15-auth-page.rf16-auth-page
        .rff-security-note p,
      .rf15-auth-page.rf16-auth-page
        .rfr-security-note p {
        color:
          #727c74 !important;
      }


      /* ==========================================================
         LOGIN OPTIONS
         ========================================================== */

      .rf15-auth-page.rf16-auth-page
        .rf11-login-remember,
      .rf15-auth-page.rf16-auth-page
        .rf11-auth-login-options {
        color:
          #636e66 !important;
      }

      .rf15-auth-page.rf16-auth-page
        .rf11-login-password-toggle,
      .rf15-auth-page.rf16-auth-page
        .rf11-signup-password-toggle {
        color:
          #435348 !important;
      }


      /* ==========================================================
         ALERTS
         ========================================================== */

      .rf15-auth-page.rf16-auth-page
        .rf11-login-auth-alert,
      .rf15-auth-page.rf16-auth-page
        .rf11-signup-alert,
      .rf15-auth-page.rf16-auth-page
        .rff-alert,
      .rf15-auth-page.rf16-auth-page
        .rfr-alert {
        color:
          #8d3538 !important;

        background:
          #fff7f7 !important;

        border-color:
          #f0d5d5 !important;
      }


      /* ==========================================================
         PASSWORD RULES
         ========================================================== */

      .rf15-auth-page.rf16-auth-page
        .rfr-password-rules > span {
        color:
          #747e76 !important;
      }

      .rf15-auth-page.rf16-auth-page
        .rfr-password-rules > span.met {
        color:
          #39704c !important;
      }


      /* ==========================================================
         SUCCESS
         ========================================================== */

      .rf15-auth-page.rf16-auth-page
        .rff-success-icon,
      .rf15-auth-page.rf16-auth-page
        .rfr-success-mark {
        color:
          #42765a !important;

        background:
          #f0f8f2 !important;

        border-color:
          #d5e8da !important;
      }

      .rf15-auth-page.rf16-auth-page
        .rff-success-message {
        color:
          #446b52 !important;

        background:
          #f4faf5 !important;

        border-color:
          #dcebe0 !important;
      }


      /* ==========================================================
         MOBILE INTRO DUPLICATION
         The main AuthLayout already provides page heading.
         ========================================================== */

      .rf15-auth-page.rf16-auth-page
        .rf11-login-mobile-brand-copy,
      .rf15-auth-page.rf16-auth-page
        .rf11-signup-mobile-intro,
      .rf15-auth-page.rf16-auth-page
        .rff-mobile-intro,
      .rf15-auth-page.rf16-auth-page
        .rfr-mobile-intro {
        display:
          none !important;
      }


      /* ==========================================================
         RESPONSIVE
         ========================================================== */

      @media (
        max-width: 1080px
      ) {
        .rf15-auth-page.rf16-auth-page {
          padding:
            16px !important;
        }

        .rf16-auth-shell {
          width:
            min(
              100%,
              850px
            );

          min-height: auto;

          grid-template-columns:
            1fr;
        }

        .rf16-auth-visual {
          min-height:
            330px;

          padding:
            26px 28px 30px;

          border-right: 0;

          border-bottom:
            1px solid
            #e4e9e3;
        }

        .rf16-auth-video {
          object-position:
            78% 45%;
        }

        .rf16-auth-video-wash {
          background:
            linear-gradient(
              90deg,
              rgba(
                255,
                255,
                255,
                .98
              ),
              rgba(
                255,
                255,
                255,
                .88
              ) 44%,
              rgba(
                255,
                255,
                255,
                .22
              ) 78%
            );
        }

        .rf16-auth-copy {
          width:
            min(
              570px,
              78%
            );

          margin-top:
            50px;
        }

        .rf16-auth-copy h1 {
          font-size:
            clamp(
              38px,
              6vw,
              54px
            );
        }

        .rf16-auth-copy p {
          max-width:
            470px;

          font-size:
            13px;
        }

        .rf16-auth-signals,
        .rf16-auth-flow {
          display:
            none;
        }

        .rf16-auth-panel {
          padding:
            42px 34px;
        }
      }


      @media (
        max-width: 680px
      ) {
        .rf15-auth-page.rf16-auth-page {
          display: block !important;

          min-height:
            100svh !important;

          padding:
            0 !important;

          background:
            #fbfcfa !important;
        }

        .rf16-auth-shell {
          width: 100%;

          min-height:
            100svh;

          border: 0;

          border-radius: 0;

          box-shadow: none;
        }

        .rf16-auth-visual {
          min-height:
            245px;

          padding:
            20px 18px 26px;
        }

        .rf16-auth-secure {
          display:
            none;
        }

        .rf16-auth-video {
          object-position:
            76% 42%;
        }

        .rf16-auth-video-wash {
          background:
            linear-gradient(
              90deg,
              rgba(
                255,
                255,
                255,
                .99
              ) 0%,
              rgba(
                255,
                255,
                255,
                .88
              ) 48%,
              rgba(
                255,
                255,
                255,
                .25
              ) 90%
            );
        }

        .rf16-auth-copy {
          width:
            min(
              82%,
              420px
            );

          margin-top:
            34px;
        }

        .rf16-auth-eyebrow {
          padding:
            6px 9px;

          margin-bottom:
            12px;

          font-size:
            8px;
        }

        .rf16-auth-copy h1 {
          font-size:
            clamp(
              31px,
              9vw,
              40px
            );

          line-height:
            1.02;
        }

        .rf16-auth-copy p {
          display:
            none;
        }

        .rf16-auth-panel {
          min-height:
            calc(
              100svh -
              245px
            );

          padding:
            30px 18px 34px;

          justify-content:
            flex-start;
        }

        .rf16-auth-card,
        .rf16-auth-footer {
          width: 100%;
        }

        .rf15-auth-page.rf16-auth-page
          .rf11-auth-card-head h2,
        .rf15-auth-page.rf16-auth-page
          .rf-auth-card-head h2,
        .rf15-auth-page.rf16-auth-page
          .rff-success-state h2,
        .rf15-auth-page.rf16-auth-page
          .rfr-success h2 {
          font-size:
            30px !important;
        }
      }


      @media (
        max-width: 390px
      ) {
        .rf16-auth-visual {
          min-height:
            220px;
        }

        .rf16-auth-copy {
          margin-top:
            28px;
        }

        .rf16-auth-copy h1 {
          font-size:
            30px;
        }

        .rf16-auth-panel {
          padding-inline:
            16px;
        }
      }


      /* ==========================================================
         REDUCED MOTION
         ========================================================== */

      @media (
        prefers-reduced-motion:
        reduce
      ) {
        .rf16-auth-page *,
        .rf16-auth-page *::before,
        .rf16-auth-page *::after {
          animation-duration:
            .01ms !important;

          animation-iteration-count:
            1 !important;

          transition-duration:
            .01ms !important;

          scroll-behavior:
            auto !important;
        }

        .rf16-auth-video {
          display:
            none;
        }

        .rf16-auth-video-layer {
          background:
            linear-gradient(
              135deg,
              #ffffff,
              #f1f4ef
            );
        }
      }
    `}</style>
  );
}