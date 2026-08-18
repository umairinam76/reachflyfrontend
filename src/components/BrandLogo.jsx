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
    "rf-brand",
    imageFailed ? "rf-brand--fallback" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={classes}
      style={{
        "--rf-brand-logo-size": `${safeSize}px`,
      }}
      title={title || undefined}
    >
      <BrandLogoStyles />

      <span className="rf-brand__icon">
        {!imageFailed ? (
          <img
            src={logoImage}
            alt={alt}
            draggable="false"
            decoding="async"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span
            className="rf-brand__fallback"
            role="img"
            aria-label={alt}
          >
            R
          </span>
        )}
      </span>

      {showName ? (
        <span className="rf-brand__name" aria-label="ReachFlyAI">
          <span className="rf-brand__reachfly">
            ReachFly
          </span>

          <span className="rf-brand__ai">
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
      .rf-brand{
        --rfbl-size:var(--rf-brand-logo-size,42px);

        display:inline-flex;
        align-items:center;
        gap:calc(var(--rfbl-size) * .22);

        width:max-content;
        max-width:100%;
        flex:0 0 auto;

        color:inherit;
        text-decoration:none;

        box-sizing:border-box;
        isolation:isolate;
      }

      /* ==========================================================
         LOGO IMAGE
         ========================================================== */

      .rf-brand__icon{
        width:var(--rfbl-size);
        height:var(--rfbl-size);
        flex:0 0 var(--rfbl-size);

        display:grid;
        place-items:center;

        position:relative;
        overflow:hidden;

        border-radius:calc(var(--rfbl-size) * .23);

        box-sizing:border-box;
      }

      .rf-brand__icon img{
        width:100%;
        height:100%;

        display:block;
        object-fit:contain;

        user-select:none;
        -webkit-user-drag:none;

        transform:translateZ(0);
      }


      /* ==========================================================
         REACHFLY AI WORDMARK
         ========================================================== */

      .rf-brand__name{
        display:inline-flex;
        align-items:baseline;
        gap:calc(var(--rfbl-size) * .09);

        min-width:0;

        white-space:nowrap;

        font-family:
          Inter,
          "Plus Jakarta Sans",
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;

        line-height:1;
        letter-spacing:-.045em;
      }

      .rf-brand__reachfly{
        color:currentColor;

        font-size:calc(var(--rfbl-size) * .48);
        font-weight:700;

        line-height:1;
      }

      /*
       * AI is deliberately smaller than ReachFly.
       */
      .rf-brand__ai{
        position:relative;
        top:-.02em;

        color:#7868ff;

        font-size:calc(var(--rfbl-size) * .25);
        font-weight:800;

        line-height:1;
        letter-spacing:-.025em;
      }


      /* ==========================================================
         FALLBACK
         ========================================================== */

      .rf-brand__fallback{
        width:100%;
        height:100%;

        display:grid;
        place-items:center;

        border-radius:inherit;

        color:#fff;

        background:
          linear-gradient(
            135deg,
            #7c63ff 0%,
            #5f63ff 42%,
            #d94eff 72%,
            #ff6bad 100%
          );

        box-shadow:
          0 8px 24px rgba(101,88,255,.28);

        font:
          800
          calc(var(--rfbl-size) * .42)/1
          Inter,
          sans-serif;
      }


      /* ==========================================================
         DARK BACKGROUND SUPPORT
         ========================================================== */

      .rf-auth-page .rf-brand,
      .rf11-auth-page .rf-brand,
      .rf15-auth-page .rf-brand,
      .rf14-marketing .rf-brand{
        color:#ffffff;
      }

      .rf-auth-page .rf-brand__ai,
      .rf11-auth-page .rf-brand__ai,
      .rf15-auth-page .rf-brand__ai{
        color:#9e92ff;
      }


      /* ==========================================================
         LIGHT BACKGROUND SUPPORT
         ========================================================== */

      header .rf-brand{
        color:#101114;
      }


      /* ==========================================================
         RESPONSIVE
         ========================================================== */

      @media(max-width:640px){
        .rf-brand{
          gap:8px;
        }

        .rf-brand__reachfly{
          font-size:calc(var(--rfbl-size) * .45);
        }

        .rf-brand__ai{
          font-size:calc(var(--rfbl-size) * .23);
        }
      }


      /* ==========================================================
         ACCESSIBILITY
         ========================================================== */

      @media(prefers-reduced-motion:reduce){
        .rf-brand,
        .rf-brand *{
          transition:none!important;
          animation:none!important;
        }
      }
    `}</style>
  );
}