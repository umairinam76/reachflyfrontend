import { useState } from "react";
import logoImage from "../assets/logo.PNG";

export default function BrandLogo({
  size = 42,
  className = "",
  alt = "ReachFlyAI",
  title = "",
  showName = true,
}) {
  const [imageFailed, setImageFailed] = useState(false);

  const safeSize = Math.max(20, Number(size) || 42);

  const classes = [
    "rf-logo-v8",
    imageFailed ? "rf-logo-v8--fallback" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={classes}
      style={{
        "--rf-logo-size": `${safeSize}px`,
      }}
      title={title || "ReachFlyAI"}
    >
      <BrandLogoStyles />

      <span className="rf-logo-v8__mark">
        {!imageFailed ? (
          <img
            src={logoImage}
            alt=""
            aria-hidden="true"
            draggable="false"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span
            className="rf-logo-v8__fallback"
            aria-hidden="true"
          >
            R
          </span>
        )}
      </span>

      {showName ? (
        <span
          className="rf-logo-v8__wordmark"
          aria-label={alt}
        >
          <span className="rf-logo-v8__reachfly">
            ReachFly
          </span>

          <span className="rf-logo-v8__ai">
            AI
          </span>
        </span>
      ) : null}
    </span>
  );
}

function BrandLogoStyles() {
  return (
    <style>{`
      /*
       * ReachFlyAI BrandLogo
       * Fully isolated namespace to avoid collisions
       * with old .brand / .rf-brand styles.
       */

      .rf-logo-v8 {
        --rf-logo-size: 42px;

        display: inline-flex;
        align-items: center;
        justify-content: flex-start;

        gap: calc(var(--rf-logo-size) * 0.19);

        width: max-content;
        max-width: 100%;

        flex: 0 0 auto;

        color: currentColor;
        text-decoration: none;

        vertical-align: middle;

        box-sizing: border-box;
      }

      .rf-logo-v8,
      .rf-logo-v8 * {
        box-sizing: border-box;
      }


      /* ==========================================================
         LOGO MARK
         ========================================================== */

      .rf-logo-v8__mark {
        position: relative;

        width: var(--rf-logo-size);
        height: var(--rf-logo-size);

        min-width: var(--rf-logo-size);
        min-height: var(--rf-logo-size);

        flex: 0 0 var(--rf-logo-size);

        display: grid;
        place-items: center;

        overflow: hidden;

        border-radius:
          calc(var(--rf-logo-size) * 0.23);

        background: transparent;

        line-height: 0;
      }

      .rf-logo-v8__mark img {
        width: 100%;
        height: 100%;

        display: block;

        object-fit: contain;
        object-position: center;

        user-select: none;
        pointer-events: none;

        -webkit-user-drag: none;

        transform: translateZ(0);
      }


      /* ==========================================================
         WORDMARK
         ========================================================== */

      .rf-logo-v8__wordmark {
        display: inline-flex;
        align-items: baseline;

        gap: calc(var(--rf-logo-size) * 0.045);

        min-width: 0;

        white-space: nowrap;

        font-family:
          Inter,
          "Plus Jakarta Sans",
          "Segoe UI",
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          sans-serif;

        line-height: 1;
      }

      .rf-logo-v8__reachfly {
        display: inline-block;

        color: currentColor;

        font-size:
          calc(var(--rf-logo-size) * 0.46);

        font-weight: 700;

        line-height: 1;

        letter-spacing: -0.045em;
      }

      .rf-logo-v8__ai {
        display: inline-block;

        position: relative;

        /*
         * Slightly higher and considerably smaller
         * than ReachFly.
         */
        top: -0.12em;

        color: #7165ff;

        font-size:
          calc(var(--rf-logo-size) * 0.21);

        font-weight: 800;

        line-height: 1;

        letter-spacing: -0.025em;
      }


      /* ==========================================================
         FALLBACK
         ========================================================== */

      .rf-logo-v8__fallback {
        width: 100%;
        height: 100%;

        display: grid;
        place-items: center;

        border-radius: inherit;

        color: #ffffff;

        background:
          linear-gradient(
            135deg,
            #7567ff 0%,
            #655cff 38%,
            #c755ff 70%,
            #ff5ca8 100%
          );

        box-shadow:
          0 8px 26px rgba(101, 88, 255, 0.28);

        font-family:
          Inter,
          system-ui,
          sans-serif;

        font-size:
          calc(var(--rf-logo-size) * 0.42);

        font-weight: 800;

        line-height: 1;
      }


      /* ==========================================================
         AUTH DARK THEME
         ========================================================== */

      .rf15-auth-page .rf-logo-v8,
      .rf11-auth-page .rf-logo-v8,
      .rf-auth-page .rf-logo-v8 {
        color: #ffffff;
      }

      .rf15-auth-page .rf-logo-v8__ai,
      .rf11-auth-page .rf-logo-v8__ai,
      .rf-auth-page .rf-logo-v8__ai {
        color: #9c91ff;
      }


      /* ==========================================================
         MARKETING LIGHT HERO
         ========================================================== */

      .rf14-marketing .rf-logo-v8,
      .rf14-hero .rf-logo-v8,
      header .rf-logo-v8 {
        color: #111312;
      }

      .rf14-marketing .rf-logo-v8__ai,
      .rf14-hero .rf-logo-v8__ai,
      header .rf-logo-v8__ai {
        color: #5e5cf0;
      }


      /* ==========================================================
         RESPONSIVE
         ========================================================== */

      @media (max-width: 640px) {
        .rf-logo-v8 {
          gap: calc(var(--rf-logo-size) * 0.16);
        }

        .rf-logo-v8__reachfly {
          font-size:
            calc(var(--rf-logo-size) * 0.44);
        }

        .rf-logo-v8__ai {
          font-size:
            calc(var(--rf-logo-size) * 0.20);
        }
      }


      /* ==========================================================
         ACCESSIBILITY
         ========================================================== */

      @media (prefers-reduced-motion: reduce) {
        .rf-logo-v8,
        .rf-logo-v8 * {
          animation: none !important;
          transition: none !important;
        }
      }
    `}</style>
  );
}