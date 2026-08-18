import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";

import {
  Check,
  Sparkles,
} from "./icons";

const DEFAULT_STAGES = [
  {
    label:
      "Scout",
    text:
      "Finding matching businesses",
  },
  {
    label:
      "Enrich",
    text:
      "Cleaning and enriching leads",
  },
  {
    label:
      "Audit",
    text:
      "Checking website opportunities",
  },
  {
    label:
      "Ready",
    text:
      "Preparing campaign pipeline",
  },
];

/**
 * Shared ReachFly progress overlay.
 *
 * Existing prop contract is preserved:
 * - visible
 * - percent
 * - message
 * - title
 *
 * `stages` and `note` are additive optional props.
 */
export default function Loader({
  visible,
  percent = 1,
  message = "Working",
  title = "Processing campaign",
  stages = DEFAULT_STAGES,
  note = "ReachFly will update this screen automatically when processing finishes.",
}) {
  const reduceMotion =
    useReducedMotion();

  const safePercent =
    Math.max(
      1,
      Math.min(
        100,
        Math.round(
          Number(
            percent
          ) ||
            1
        )
      )
    );

  const safeStages =
    Array.isArray(
      stages
    ) &&
    stages.length
      ? stages
      : DEFAULT_STAGES;

  return (
    <>
      <LoaderV7Styles />

      <AnimatePresence>
        {visible ? (
          <motion.div
            className="rf-loader-backdrop"
            initial={{
              opacity:
                0,
            }}
            animate={{
              opacity:
                1,
            }}
            exit={{
              opacity:
                0,
            }}
            transition={{
              duration:
                reduceMotion
                  ? 0
                  : 0.16,
            }}
            role="status"
            aria-live="polite"
            aria-busy="true"
          >
            <motion.div
              className="rf-loader-card"
              initial={
                reduceMotion
                  ? {
                      opacity:
                        0,
                    }
                  : {
                      y:
                        22,
                      scale:
                        0.975,
                      opacity:
                        0,
                    }
              }
              animate={{
                y:
                  0,
                scale:
                  1,
                opacity:
                  1,
              }}
              exit={
                reduceMotion
                  ? {
                      opacity:
                        0,
                    }
                  : {
                      y:
                        18,
                      scale:
                        0.98,
                      opacity:
                        0,
                    }
              }
              transition={{
                duration:
                  reduceMotion
                    ? 0
                    : 0.22,
                ease:
                  "easeOut",
              }}
            >
              <header className="rf-loader-header">
                <span className="rf-loader-brand-mark">
                  <Sparkles
                    size={15}
                    aria-hidden="true"
                  />
                </span>

                <div>
                  <small>
                    ReachFly live progress
                  </small>

                  <strong>
                    Secure workspace operation
                  </strong>
                </div>
              </header>

              <div className="rf-loader-visual">
                <div
                  className="rf-loader-orbit"
                  aria-hidden="true"
                >
                  <i />
                  <i />
                  <i />
                  <span />
                </div>

                <div
                  className="rf-loader-percent-ring"
                  role="progressbar"
                  aria-label={
                    title
                  }
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={
                    safePercent
                  }
                >
                  <svg
                    viewBox="0 0 120 120"
                    aria-hidden="true"
                  >
                    <circle
                      cx="60"
                      cy="60"
                      r="52"
                    />

                    <circle
                      cx="60"
                      cy="60"
                      r="52"
                      style={{
                        strokeDashoffset:
                          `${
                            326.73 -
                            (
                              326.73 *
                              safePercent
                            ) /
                              100
                          }`,
                      }}
                    />
                  </svg>

                  <div>
                    <b>
                      {safePercent}%
                    </b>

                    <small>
                      complete
                    </small>
                  </div>
                </div>
              </div>

              <div className="rf-loader-copy">
                <span className="rf-loader-eyebrow">
                  Processing
                </span>

                <h2>
                  {title}
                </h2>

                <p>
                  {message}
                </p>
              </div>

              <div
                className="rf-loader-progress"
                aria-hidden="true"
              >
                <span
                  style={{
                    width:
                      `${safePercent}%`,
                  }}
                />
              </div>

              <div className="rf-loader-stage-grid">
                {safeStages.map(
                  (
                    stage,
                    index
                  ) => {
                    const stageEnd =
                      (
                        (
                          index +
                          1
                        ) /
                        safeStages.length
                      ) *
                      100;

                    const stageStart =
                      (
                        index /
                        safeStages.length
                      ) *
                      100;

                    const done =
                      safePercent >=
                        stageEnd ||
                      safePercent ===
                        100;

                    const current =
                      !done &&
                      safePercent >=
                        stageStart;

                    return (
                      <div
                        key={
                          stage.label ||
                          index
                        }
                        className={[
                          done
                            ? "done"
                            : "",
                          current
                            ? "current"
                            : "",
                        ]
                          .filter(
                            Boolean
                          )
                          .join(
                            " "
                          )}
                      >
                        <span>
                          {done ? (
                            <Check
                              size={13}
                              aria-hidden="true"
                            />
                          ) : (
                            index +
                            1
                          )}
                        </span>

                        <div>
                          <b>
                            {stage.label ||
                              `Stage ${
                                index +
                                1
                              }`}
                          </b>

                          {stage.text ? (
                            <small>
                              {
                                stage.text
                              }
                            </small>
                          ) : null}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>

              {note ? (
                <p className="rf-loader-note">
                  {note}
                </p>
              ) : null}
            </motion.div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}

function LoaderV7Styles() {
  return (
    <style>{`
      .rf-loader-backdrop{
        --rfl-text:#191c1d;
        --rfl-text2:#4d4c59;
        --rfl-muted:#777784;
        --rfl-line:#e2e4e7;
        --rfl-primary:#4648d4;
        --rfl-primary-soft:#e8e9ff;
        --rfl-violet:#6b38d4;
        --rfl-violet-soft:#f1ebff;
        --rfl-green:#087a51;
        --rfl-green-soft:#e4f7ee;
        --rfl-dark:#2e3132;
        position:fixed;
        z-index:2147481500;
        inset:0;
        display:grid;
        place-items:center;
        padding:20px;
        background:rgba(25,28,29,.56);
        backdrop-filter:blur(10px);
        font-family:
          Inter,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
      }

      .rf-loader-backdrop *,
      .rf-loader-backdrop *::before,
      .rf-loader-backdrop *::after{
        box-sizing:border-box;
      }

      @keyframes rflOrbit{
        to{
          transform:rotate(360deg);
        }
      }

      @keyframes rflOrbitReverse{
        to{
          transform:rotate(-360deg);
        }
      }

      @keyframes rflPulse{
        0%,100%{
          opacity:.45;
          transform:scale(.94);
        }
        50%{
          opacity:1;
          transform:scale(1);
        }
      }

      @keyframes rflCurrent{
        0%,100%{
          box-shadow:
            0 0 0 0 rgba(70,72,212,.14);
        }
        50%{
          box-shadow:
            0 0 0 5px rgba(70,72,212,0);
        }
      }

      .rf-loader-card{
        width:min(590px,100%);
        max-height:calc(100vh - 40px);
        overflow:auto;
        display:grid;
        gap:14px;
        padding:17px;
        color:var(--rfl-text);
        background:
          radial-gradient(
            circle at 92% 4%,
            rgba(70,72,212,.075),
            transparent 31%
          ),
          #fff;
        border:1px solid rgba(255,255,255,.3);
        border-radius:16px;
        box-shadow:
          0 28px 80px rgba(0,0,0,.22);
      }

      .rf-loader-header{
        min-height:45px;
        display:grid;
        grid-template-columns:36px minmax(0,1fr);
        align-items:center;
        gap:8px;
        padding-bottom:10px;
        border-bottom:1px solid #eff0f1;
      }

      .rf-loader-brand-mark{
        width:36px;
        height:36px;
        display:grid;
        place-items:center;
        color:#fff;
        background:
          linear-gradient(
            135deg,
            #5759df,
            #4648d4
          );
        border-radius:9px;
        box-shadow:
          0 7px 15px rgba(70,72,212,.14);
      }

      .rf-loader-header > div{
        min-width:0;
        display:grid;
      }

      .rf-loader-header small{
        color:var(--rfl-primary);
        font-size:5.4px;
        font-weight:800;
        letter-spacing:.07em;
        text-transform:uppercase;
      }

      .rf-loader-header strong{
        margin-top:2px;
        color:var(--rfl-text);
        font-size:6.7px;
      }

      .rf-loader-visual{
        position:relative;
        width:144px;
        height:144px;
        display:grid;
        place-items:center;
        justify-self:center;
      }

      .rf-loader-orbit{
        position:absolute;
        inset:3px;
        border:1px solid #e2e3ff;
        border-radius:50%;
        animation:
          rflOrbit 5.5s
          linear infinite;
      }

      .rf-loader-orbit::before{
        content:"";
        position:absolute;
        inset:14px;
        border:
          1px dashed
          rgba(107,56,212,.23);
        border-radius:50%;
        animation:
          rflOrbitReverse 6.8s
          linear infinite;
      }

      .rf-loader-orbit i{
        position:absolute;
        width:7px;
        height:7px;
        background:var(--rfl-primary);
        border:2px solid #fff;
        border-radius:50%;
        box-shadow:
          0 0 0 1px
          rgba(70,72,212,.12);
      }

      .rf-loader-orbit i:nth-child(1){
        top:-3px;
        left:50%;
      }

      .rf-loader-orbit i:nth-child(2){
        right:10px;
        bottom:18px;
        background:var(--rfl-violet);
      }

      .rf-loader-orbit i:nth-child(3){
        bottom:13px;
        left:15px;
        background:#7678e9;
      }

      .rf-loader-orbit > span{
        position:absolute;
        top:50%;
        left:-4px;
        width:8px;
        height:8px;
        background:#9d9ff1;
        border:2px solid #fff;
        border-radius:50%;
      }

      .rf-loader-percent-ring{
        position:relative;
        width:112px;
        height:112px;
        display:grid;
        place-items:center;
        background:#fff;
        border-radius:50%;
        box-shadow:
          0 10px 30px rgba(70,72,212,.08);
      }

      .rf-loader-percent-ring svg{
        position:absolute;
        inset:0;
        width:100%;
        height:100%;
        transform:rotate(-90deg);
      }

      .rf-loader-percent-ring circle{
        fill:none;
        stroke-width:7;
      }

      .rf-loader-percent-ring circle:first-child{
        stroke:#ececff;
      }

      .rf-loader-percent-ring circle:last-child{
        stroke:var(--rfl-primary);
        stroke-linecap:round;
        stroke-dasharray:326.73;
        transition:
          stroke-dashoffset .32s
          cubic-bezier(.2,.8,.2,1);
      }

      .rf-loader-percent-ring > div{
        display:grid;
        text-align:center;
      }

      .rf-loader-percent-ring b{
        font:
          600 22px/27px
          Geist,
          Inter,
          sans-serif;
        letter-spacing:-.03em;
      }

      .rf-loader-percent-ring small{
        margin-top:1px;
        color:var(--rfl-muted);
        font-size:5.4px;
        text-transform:uppercase;
      }

      .rf-loader-copy{
        display:grid;
        justify-items:center;
        text-align:center;
      }

      .rf-loader-eyebrow{
        color:var(--rfl-primary);
        font-size:5.5px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rf-loader-copy h2{
        margin:3px 0 0;
        color:var(--rfl-text);
        font:
          600 18px/24px
          Geist,
          Inter,
          sans-serif;
        letter-spacing:-.02em;
      }

      .rf-loader-copy p{
        max-width:440px;
        margin:4px 0 0;
        color:var(--rfl-text2);
        font-size:7px;
        line-height:12px;
      }

      .rf-loader-progress{
        height:7px;
        overflow:hidden;
        background:#eff0f2;
        border-radius:999px;
      }

      .rf-loader-progress > span{
        display:block;
        height:100%;
        background:
          linear-gradient(
            90deg,
            #5658df,
            #4648d4,
            #6b38d4
          );
        border-radius:inherit;
        transition:
          width .32s
          cubic-bezier(.2,.8,.2,1);
      }

      .rf-loader-stage-grid{
        display:grid;
        grid-template-columns:
          repeat(
            4,
            minmax(0,1fr)
          );
        gap:6px;
      }

      .rf-loader-stage-grid > div{
        min-width:0;
        min-height:78px;
        display:grid;
        grid-template-columns:28px minmax(0,1fr);
        align-items:center;
        gap:7px;
        padding:8px;
        color:var(--rfl-muted);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:9px;
      }

      .rf-loader-stage-grid > div > span{
        width:28px;
        height:28px;
        display:grid;
        place-items:center;
        color:#767781;
        background:#fff;
        border:1px solid #e6e7e9;
        border-radius:7px;
        font-size:5.8px;
        font-weight:800;
      }

      .rf-loader-stage-grid > div > div{
        min-width:0;
        display:grid;
      }

      .rf-loader-stage-grid b{
        color:var(--rfl-text2);
        font-size:5.8px;
      }

      .rf-loader-stage-grid small{
        margin-top:2px;
        color:var(--rfl-muted);
        font-size:5px;
        line-height:8px;
      }

      .rf-loader-stage-grid > div.done{
        color:var(--rfl-green);
        background:var(--rfl-green-soft);
        border-color:#d0ecdf;
      }

      .rf-loader-stage-grid > div.done > span{
        color:var(--rfl-green);
        background:#fff;
        border-color:#cbe8da;
      }

      .rf-loader-stage-grid > div.done b{
        color:var(--rfl-green);
      }

      .rf-loader-stage-grid > div.current{
        color:var(--rfl-primary);
        background:var(--rfl-primary-soft);
        border-color:#d9daff;
        animation:
          rflCurrent 1.4s
          ease-in-out infinite;
      }

      .rf-loader-stage-grid > div.current > span{
        color:#fff;
        background:var(--rfl-primary);
        border-color:var(--rfl-primary);
      }

      .rf-loader-stage-grid > div.current b{
        color:var(--rfl-primary);
      }

      .rf-loader-note{
        margin:0;
        padding:9px 10px;
        color:#5d5e68;
        background:#f7f7fc;
        border:1px solid #e6e6f3;
        border-radius:8px;
        text-align:center;
        font-size:5.8px;
        line-height:10px;
      }

      @media(max-width:620px){
        .rf-loader-backdrop{
          padding:10px;
        }

        .rf-loader-card{
          padding:14px;
          border-radius:14px;
        }

        .rf-loader-visual{
          width:126px;
          height:126px;
        }

        .rf-loader-percent-ring{
          width:98px;
          height:98px;
        }

        .rf-loader-stage-grid{
          grid-template-columns:
            1fr 1fr;
        }

        .rf-loader-stage-grid > div{
          min-height:68px;
        }
      }

      @media(max-width:380px){
        .rf-loader-stage-grid{
          grid-template-columns:1fr;
        }

        .rf-loader-visual{
          width:112px;
          height:112px;
        }

        .rf-loader-percent-ring{
          width:88px;
          height:88px;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-loader-orbit,
        .rf-loader-orbit::before,
        .rf-loader-stage-grid > div.current{
          animation:none!important;
        }

        .rf-loader-backdrop *,
        .rf-loader-backdrop *::before,
        .rf-loader-backdrop *::after{
          transition-duration:.01ms!important;
        }
      }
    `}</style>
  );
}
