import {
  ArrowRight,
  Inbox,
} from "./icons";

import {
  Link,
} from "react-router-dom";

/**
 * Shared ReachFly V7 empty state.
 *
 * Existing prop contract is preserved:
 * - title
 * - text
 * - action
 * - to
 *
 * Optional props are additive and backward compatible.
 */
export default function EmptyState({
  title,
  text,
  action = "Build a campaign",
  to = "/app/builder",
  icon: Icon = Inbox,
  compact = false,
  className = "",
}) {
  const hasAction =
    Boolean(
      action &&
        to
    );

  return (
    <div
      className={[
        "empty",
        "rf-empty-v7",
        compact
          ? "rf-empty-v7--compact"
          : "",
        className,
      ]
        .filter(
          Boolean
        )
        .join(
          " "
        )}
    >
      <EmptyStateStyles />

      <span
        className="rf-empty-v7__icon"
        aria-hidden="true"
      >
        <Icon size={22} />
      </span>

      <div className="rf-empty-v7__copy">
        <h3>
          {title ||
            "Nothing here yet"}
        </h3>

        {text ? (
          <p>
            {text}
          </p>
        ) : null}
      </div>

      {hasAction ? (
        <Link
          className="btn primary rf-empty-v7__action"
          to={
            to
          }
        >
          <span>
            {action}
          </span>

          <ArrowRight
            size={13}
            aria-hidden="true"
          />
        </Link>
      ) : null}
    </div>
  );
}

function EmptyStateStyles() {
  return (
    <style>{`
      .rf-empty-v7{
        --rfe-text:#191c1d;
        --rfe-text2:#4d4c59;
        --rfe-muted:#777784;
        --rfe-line:#e2e4e7;
        --rfe-primary:#4648d4;
        --rfe-primary-dark:#393bbb;
        --rfe-primary-soft:#e8e9ff;
        --rfe-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:260px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:10px;
        padding:30px 22px;
        color:var(--rfe-text);
        background:
          radial-gradient(
            circle at 50% 0%,
            rgba(70,72,212,.055),
            transparent 34%
          ),
          #fff;
        border:1px dashed #d9dbdf;
        border-radius:12px;
        text-align:center;
        box-sizing:border-box;
        font-family:
          Inter,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
      }

      .rf-empty-v7 *,
      .rf-empty-v7 *::before,
      .rf-empty-v7 *::after{
        box-sizing:border-box;
      }

      .rf-empty-v7__icon{
        width:52px;
        height:52px;
        display:grid;
        place-items:center;
        color:var(--rfe-primary);
        background:var(--rfe-primary-soft);
        border:1px solid #dddfff;
        border-radius:13px;
        box-shadow:
          0 8px 20px rgba(70,72,212,.07);
      }

      .rf-empty-v7__copy{
        max-width:470px;
        display:grid;
        gap:4px;
      }

      .rf-empty-v7__copy h3{
        margin:0;
        color:var(--rfe-text);
        font:
          600 13px/18px
          Geist,
          Inter,
          sans-serif;
        letter-spacing:-.015em;
      }

      .rf-empty-v7__copy p{
        margin:0;
        color:var(--rfe-muted);
        font-size:7px;
        line-height:12px;
      }

      .rf-empty-v7__action{
        min-height:38px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        margin-top:2px;
        padding:7px 11px;
        color:#fff!important;
        background:var(--rfe-primary)!important;
        border:1px solid var(--rfe-primary)!important;
        border-radius:8px!important;
        box-shadow:
          0 7px 16px rgba(70,72,212,.13);
        text-decoration:none!important;
        font-size:6.5px!important;
        font-weight:750!important;
        transition:
          transform .14s var(--rfe-ease),
          background .14s var(--rfe-ease),
          box-shadow .14s var(--rfe-ease);
      }

      .rf-empty-v7__action:hover{
        transform:translateY(-1px);
        background:var(--rfe-primary-dark)!important;
        box-shadow:
          0 10px 20px rgba(70,72,212,.16);
      }

      .rf-empty-v7--compact{
        min-height:190px;
        padding:22px 18px;
      }

      .rf-empty-v7--compact .rf-empty-v7__icon{
        width:44px;
        height:44px;
        border-radius:11px;
      }

      @media(max-width:620px){
        .rf-empty-v7{
          min-height:220px;
          padding:24px 16px;
        }

        .rf-empty-v7__copy p{
          font-size:6.5px;
          line-height:11px;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-empty-v7 *,
        .rf-empty-v7 *::before,
        .rf-empty-v7 *::after{
          transition-duration:.01ms!important;
          animation:none!important;
        }
      }
    `}</style>
  );
}
