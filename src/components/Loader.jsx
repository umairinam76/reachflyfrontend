import { AnimatePresence, motion } from "framer-motion";
import { Check } from "./icons";

const stages = [
  {
    label: "Scout",
    text: "Finding matching businesses",
  },
  {
    label: "Enrich",
    text: "Cleaning and enriching leads",
  },
  {
    label: "Audit",
    text: "Checking website opportunities",
  },
  {
    label: "Ready",
    text: "Preparing campaign pipeline",
  },
];

export default function Loader({
  visible,
  percent = 1,
  message = "Working",
  title = "Processing campaign",
}) {
  const safePercent = Math.max(1, Math.min(100, Math.round(Number(percent) || 1)));

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="rf-loader-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          role="status"
          aria-live="polite"
        >
          <motion.div
            className="rf-loader-card"
            initial={{ y: 26, scale: 0.96, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 26, scale: 0.96, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            <div className="rf-loader-visual">
              <div className="rf-loader-orbit">
                <i />
                <i />
                <i />
                <span />
              </div>

              <div className="rf-loader-percent-ring">
                <svg viewBox="0 0 120 120" aria-hidden="true">
                  <circle cx="60" cy="60" r="52" />
                  <circle
                    cx="60"
                    cy="60"
                    r="52"
                    style={{
                      strokeDashoffset: `${326.73 - (326.73 * safePercent) / 100}`,
                    }}
                  />
                </svg>

                <div>
                  <b>{safePercent}%</b>
                  <small>complete</small>
                </div>
              </div>
            </div>

            <div className="rf-loader-copy">
              <span className="rf-loader-eyebrow">Live backend progress</span>
              <h2>{title}</h2>
              <p>{message}</p>
            </div>

            <div className="rf-loader-progress">
              <span style={{ width: `${safePercent}%` }} />
            </div>

            <div className="rf-loader-stage-grid">
              {stages.map((stage, index) => {
                const stageEnd = ((index + 1) / stages.length) * 100;
                const stageStart = (index / stages.length) * 100;
                const done = safePercent >= stageEnd || safePercent === 100;
                const current = !done && safePercent >= stageStart;

                return (
                  <div
                    key={stage.label}
                    className={`${done ? "done" : ""} ${current ? "current" : ""}`}
                  >
                    <span>{done ? <Check size={13} /> : index + 1}</span>

                    <div>
                      <b>{stage.label}</b>
                      <small>{stage.text}</small>
                    </div>
                  </div>
                );
              })}
            </div>

            <p className="rf-loader-note">
              Keep this window open. The campaign page will update automatically
              when processing finishes.
            </p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}