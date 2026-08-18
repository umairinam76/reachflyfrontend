import BrandLogo from "./BrandLogo";

/**
 * Compact ReachFly brand lockup used by legacy and embedded surfaces.
 *
 * Existing prop contract is preserved:
 * - light
 *
 * Optional props are additive and backwards compatible.
 */
export default function Brand({
  light = false,
  compact = false,
  subtitle = "Sales OS",
  className = "",
}) {
  return (
    <div
      className={[
        "brand",
        "rf-brand-v7",
        light
          ? "brand-light rf-brand-v7--light"
          : "",
        compact
          ? "rf-brand-v7--compact"
          : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <BrandStyles />

      <BrandLogo
        size={compact ? 34 : 40}
        className="rf-brand-v7__logo"
        alt="ReachFlyAI"
      />


    </div>
  );
}

function BrandStyles() {
  return (
    <style>{`
      .rf-brand-v7{
        --rfb-text:#191c1d;
        --rfb-muted:#777784;
        --rfb-light:#f8f9fa;
        --rfb-light-muted:rgba(248,249,250,.62);
        min-width:0;
        display:inline-flex;
        align-items:center;
        gap:9px;
        color:var(--rfb-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .rf-brand-v7 *,
      .rf-brand-v7 *::before,
      .rf-brand-v7 *::after{
        box-sizing:border-box;
      }

      .rf-brand-v7__logo{
        flex:0 0 auto;
      }

      .rf-brand-v7__copy{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .rf-brand-v7__copy b{
        overflow:hidden;
        color:inherit;
        text-overflow:ellipsis;
        white-space:nowrap;
        font:650 13px/17px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rf-brand-v7__copy small{
        overflow:hidden;
        color:var(--rfb-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:6px;
        font-weight:700;
        letter-spacing:.055em;
        text-transform:uppercase;
      }

      .rf-brand-v7--light{
        color:var(--rfb-light);
      }

      .rf-brand-v7--light .rf-brand-v7__copy small{
        color:var(--rfb-light-muted);
      }

      .rf-brand-v7--light .rf-brand-v7__logo{
        background:rgba(255,255,255,.94);
        border-color:rgba(255,255,255,.14);
        box-shadow:0 7px 18px rgba(0,0,0,.14);
      }

      .rf-brand-v7--compact{
        gap:7px;
      }

      .rf-brand-v7--compact .rf-brand-v7__copy b{
        font-size:11px;
        line-height:15px;
      }

      .rf-brand-v7--compact .rf-brand-v7__copy small{
        font-size:5px;
      }

      @media(max-width:420px){
        .rf-brand-v7__copy small{
          display:none;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-brand-v7,
        .rf-brand-v7 *{
          animation:none!important;
          transition:none!important;
        }
      }
    `}</style>
  );
}
