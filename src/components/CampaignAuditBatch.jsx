import { useEffect, useMemo, useRef, useState } from "react";
import { Brain, Sparkles } from "../components/icons";
import { upgradeApi } from "../api";

export default function CampaignAuditBatch({ campaign, onUpdated }) {
  const eligibleCount = useMemo(
    () =>
      (campaign?.leads || []).filter(
        (lead) =>
          lead.website &&
          !lead.auditId &&
          !["do_not_call", "not_interested"].includes(lead.status)
      ).length,
    [campaign]
  );
  const [form, setForm] = useState({
    limit: Math.min(50, eligibleCount || 50),
    offer: campaign?.offer || "",
    runPageSpeed: false,
  });
  const [job, setJob] = useState(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const timerRef = useRef(null);

  useEffect(() => {
    upgradeApi
      .auditJobs(campaign.id)
      .then((jobs) => {
        const active = (jobs || []).find((item) =>
          ["queued", "running"].includes(item.status)
        );
        if (active) {
          setJob(active);
          poll(active.id);
        }
      })
      .catch(() => {});

    return () => clearInterval(timerRef.current);
  }, [campaign.id]);

  const poll = (jobId) => {
    clearInterval(timerRef.current);
    timerRef.current = setInterval(async () => {
      try {
        const next = await upgradeApi.auditJob(jobId);
        setJob(next);
        if (["complete", "failed", "cancelled"].includes(next.status)) {
          clearInterval(timerRef.current);
          onUpdated?.();
        }
      } catch (e) {
        clearInterval(timerRef.current);
        setError(e.message);
      }
    }, 4000);
  };

  const start = async () => {
    try {
      setStarting(true);
      setError("");
      const next = await upgradeApi.createAuditJob(campaign.id, {
        limit: Number(form.limit || 1),
        offer: form.offer,
        runPageSpeed: form.runPageSpeed,
        onlyWithoutAudit: true,
      });
      setJob(next);
      poll(next.id);
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  };

  const processed = Number(job?.completed || 0) + Number(job?.failed || 0);

  return (
    <section className="cardish rf-campaign-audit-batch mt24">
      <div className="section-title-row">
        <div>
          <span className="eyebrow">Audit queue</span>
          <h2>Attach audit reports to calling leads</h2>
          <p>
            Process the strongest website leads first. Callers receive only the
            score, evidence summary, opener, tags, and follow-up copy.
          </p>
        </div>
        <Brain />
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      {job && ["queued", "running"].includes(job.status) ? (
        <div className="rf-audit-job-progress">
          <div>
            <b>{job.status === "queued" ? "Audit job queued" : "Generating audits"}</b>
            <small>
              {processed}/{job.total} processed
              {job.currentLead ? ` · ${job.currentLead}` : ""}
            </small>
          </div>
          <span><i style={{ width: `${job.percent || 1}%` }} /></span>
          <strong>{job.percent || 0}%</strong>
        </div>
      ) : (
        <>
          <div className="rf-audit-batch-controls">
            <label className="field">
              <span>Number of leads</span>
              <input
                type="number"
                min="1"
                max="200"
                value={form.limit}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    limit: event.target.value,
                  }))
                }
              />
            </label>
            <label className="field rf-audit-offer-field">
              <span>Offer context</span>
              <input
                value={form.offer}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    offer: event.target.value,
                  }))
                }
                placeholder="Patient enquiry automation and CRM integration"
              />
            </label>
          </div>

          <label className="rf-assignment-option">
            <input
              type="checkbox"
              checked={form.runPageSpeed}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  runPageSpeed: event.target.checked,
                }))
              }
            />
            Include PageSpeed/Lighthouse for every lead. This increases latency and API usage.
          </label>

          <button
            className="btn primary"
            type="button"
            onClick={start}
            disabled={starting || !eligibleCount}
          >
            <Sparkles size={14} />
            {starting
              ? "Starting audit job…"
              : `Audit up to ${Math.min(Number(form.limit || 0), eligibleCount)} leads`}
          </button>
          <p className="text-xs text-muted mt8">
            {eligibleCount} website leads do not yet have an audit. Jobs continue
            on the server; use a durable Redis queue before multi-instance production.
          </p>
        </>
      )}

      {job?.status === "complete" ? (
        <p className="success-banner mt16">
          Completed {job.completed} audits; {job.failed} failed.
        </p>
      ) : null}
    </section>
  );
}
