import {
  useState,
} from "react";

export default function BrandLogo({
  size = 42,
  className = "",
  alt = "ReachFly.Ai",
  title = "",
}) {
  const [
    imageFailed,
    setImageFailed,
  ] = useState(false);

  const safeSize =
    Math.max(
      20,
      Number(
        size
      ) ||
        42
    );

  const classes = [
    "rf-brand-logo",
    "rf-brand-logo-v7",
    imageFailed
      ? "rf-brand-logo-v7--fallback"
      : "",
    className,
  ]
    .filter(
      Boolean
    )
    .join(
      " "
    );

  return (
    <span
      className={classes}
      style={{
        "--rf-brand-logo-size":
          `${safeSize}px`,
      }}
      title={
        title ||
        undefined
      }
    >
      <BrandLogoStyles />

      {!imageFailed ? (
        <img
          src="/favicon.svg"
          alt={alt}
          draggable="false"
          decoding="async"
          onError={() =>
            setImageFailed(
              true
            )
          }
        />
      ) : (
        <span
          className="rf-brand-logo-v7__fallback"
          role="img"
          aria-label={alt}
        >
          R
        </span>
      )}
    </span>
  );
}

function BrandLogoStyles() {
  return (
    <style>{`
      .rf-brand-logo-v7{
        --rfbl-size:var(--rf-brand-logo-size,42px);
        width:var(--rfbl-size);
        height:var(--rfbl-size);
        flex:0 0 var(--rfbl-size);
        display:inline-grid;
        place-items:center;
        overflow:hidden;
        position:relative;
        border-radius:calc(var(--rfbl-size) * .24);
        background:
          linear-gradient(145deg,#f8f8ff,#fff);
        border:1px solid rgba(70,72,212,.12);
        box-shadow:
          0 4px 12px rgba(25,28,29,.055),
          inset 0 0 0 1px rgba(255,255,255,.6);
        box-sizing:border-box;
        isolation:isolate;
      }

      .rf-brand-logo-v7::before{
        content:"";
        position:absolute;
        z-index:-1;
        inset:-35%;
        background:
          radial-gradient(circle at 34% 30%,rgba(70,72,212,.14),transparent 30%),
          radial-gradient(circle at 72% 74%,rgba(107,56,212,.11),transparent 32%);
      }

      .rf-brand-logo-v7 img{
        width:78%;
        height:78%;
        display:block;
        object-fit:contain;
        user-select:none;
        -webkit-user-drag:none;
      }

      .rf-brand-logo-v7__fallback{
        width:76%;
        height:76%;
        display:grid;
        place-items:center;
        color:#fff;
        background:linear-gradient(135deg,#5658df,#4648d4 54%,#6b38d4);
        border-radius:27%;
        font:800 calc(var(--rfbl-size) * .39)/1 Geist,Inter,sans-serif;
        letter-spacing:-.05em;
      }

      .rf-brand-logo-v7--fallback{
        border-color:rgba(70,72,212,.18);
      }

      @media(prefers-reduced-motion:reduce){
        .rf-brand-logo-v7,
        .rf-brand-logo-v7 *{
          transition:none!important;
          animation:none!important;
        }
      }
    `}</style>
  );
}
