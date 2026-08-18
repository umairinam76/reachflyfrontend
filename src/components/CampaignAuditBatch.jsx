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

          if (next.status === "complete") {
            notifyCampaignAudit(
              "success",
              "Audit batch completed",
              `${Number(next.completed || 0)} audit${
                Number(next.completed || 0) === 1 ? "" : "s"
              } completed.`
            );
          } else if (next.status === "failed") {
            notifyCampaignAudit(
              "error",
              "Audit batch stopped",
              next.error || "The audit batch could not be completed."
            );
          }

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

      notifyCampaignAudit(
        "success",
        "Audit batch started",
        `ReachFly queued up to ${Math.min(
          Number(form.limit || 1),
          eligibleCount
        )} website lead${Math.min(
          Number(form.limit || 1),
          eligibleCount
        ) === 1 ? "" : "s"} for audit.`
      );

      poll(next.id);
    } catch (e) {
      const message =
        e?.message ||
        "The audit batch could not be started.";

      setError(message);

      notifyCampaignAudit(
        "error",
        "Audit batch could not start",
        message
      );
    } finally {
      setStarting(false);
    }
  };

  const processed = Number(job?.completed || 0) + Number(job?.failed || 0);

  return (
    <section className="cardish rf-campaign-audit-batch rf-campaign-audit-batch-v7 mt24">
      <CampaignAuditBatchV7Styles />
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
            Include advanced website performance checks for every lead. This takes longer and uses more audit capacity.
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
            on the server even if you leave this page; return later to see the latest status.
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


function notifyCampaignAudit(
  type,
  title,
  message
) {
  if (typeof window === "undefined") {
    return;
  }

  const bridge =
    window.reachflyToast;

  if (
    bridge &&
    typeof bridge[type] === "function"
  ) {
    bridge[type](title, message);
    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      "reachfly:toast",
      {
        detail: {
          type,
          title,
          message,
        },
      }
    )
  );
}

function CampaignAuditBatchV7Styles() {
  return (
    <style>{`
      .rf-campaign-audit-batch-v7{
        --rfcab-text:#191c1d;
        --rfcab-text2:#4d4c59;
        --rfcab-muted:#777784;
        --rfcab-line:#e2e4e7;
        --rfcab-primary:#4648d4;
        --rfcab-primary-dark:#393bbb;
        --rfcab-primary-soft:#e8e9ff;
        --rfcab-violet:#6b38d4;
        --rfcab-violet-soft:#f1ebff;
        --rfcab-green:#087a51;
        --rfcab-green-soft:#e4f7ee;
        --rfcab-red:#ba1a1a;
        --rfcab-red-soft:#ffedeb;
        --rfcab-ease:cubic-bezier(.2,.8,.2,1);
        display:grid;
        gap:10px;
        padding:14px!important;
        color:var(--rfcab-text);
        background:
          radial-gradient(circle at 94% 5%,rgba(107,56,212,.055),transparent 31%),
          #fff!important;
        border:1px solid #e4dcf8!important;
        border-radius:12px!important;
        box-shadow:0 1px 3px rgba(25,28,29,.025)!important;
      }

      .rf-campaign-audit-batch-v7 *,
      .rf-campaign-audit-batch-v7 *::before,
      .rf-campaign-audit-batch-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfcabPulse{
        0%,100%{opacity:.45}
        50%{opacity:1}
      }

      @keyframes rfcabIn{
        from{opacity:0;transform:translateY(-4px)}
        to{opacity:1;transform:none}
      }

      .rf-campaign-audit-batch-v7 .section-title-row{
        min-height:68px;
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:14px;
        padding-bottom:10px;
        border-bottom:1px solid #eff0f1;
      }

      .rf-campaign-audit-batch-v7 .section-title-row > div{
        min-width:0;
      }

      .rf-campaign-audit-batch-v7 .section-title-row > svg{
        width:38px;
        height:38px;
        padding:9px;
        color:var(--rfcab-violet);
        background:var(--rfcab-violet-soft);
        border-radius:9px;
      }

      .rf-campaign-audit-batch-v7 .eyebrow{
        display:block;
        margin-bottom:3px;
        color:var(--rfcab-violet);
        font-size:5.7px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rf-campaign-audit-batch-v7 h2{
        margin:0;
        font:600 15px/20px Geist,Inter,sans-serif;
        letter-spacing:-.015em;
      }

      .rf-campaign-audit-batch-v7 .section-title-row p{
        max-width:760px;
        margin:4px 0 0;
        color:var(--rfcab-text2);
        font-size:6.3px;
        line-height:10px;
      }

      .rf-campaign-audit-batch-v7 .error-banner,
      .rf-campaign-audit-batch-v7 .success-banner{
        padding:10px 11px;
        margin:0;
        border:1px solid;
        border-radius:8px;
        font-size:6.4px;
        line-height:10px;
        animation:rfcabIn .16s var(--rfcab-ease);
      }

      .rf-campaign-audit-batch-v7 .error-banner{
        color:#7c1d1d;
        background:var(--rfcab-red-soft);
        border-color:#ffd0cc;
      }

      .rf-campaign-audit-batch-v7 .success-banner{
        color:#086846;
        background:var(--rfcab-green-soft);
        border-color:#caeadb;
      }

      .rf-campaign-audit-batch-v7 .rf-audit-batch-controls{
        display:grid;
        grid-template-columns:180px minmax(0,1fr);
        gap:8px;
      }

      .rf-campaign-audit-batch-v7 .field{
        display:grid;
        gap:4px;
      }

      .rf-campaign-audit-batch-v7 .field > span{
        color:var(--rfcab-muted);
        font-size:5.6px;
        font-weight:750;
        text-transform:uppercase;
      }

      .rf-campaign-audit-batch-v7 input{
        width:100%;
        min-height:38px;
        padding:8px 9px;
        color:var(--rfcab-text);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
        outline:0;
        font:400 7px/12px Inter,sans-serif;
        transition:.13s var(--rfcab-ease);
      }

      .rf-campaign-audit-batch-v7 input:focus{
        background:#fff;
        border-color:rgba(107,56,212,.46);
        box-shadow:0 0 0 3px rgba(107,56,212,.06);
      }

      .rf-campaign-audit-batch-v7 .rf-assignment-option{
        min-height:49px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:9px 10px;
        color:var(--rfcab-text2);
        background:#f7f8f9;
        border:1px solid var(--rfcab-line);
        border-radius:8px;
        font-size:6px;
        line-height:10px;
      }

      .rf-campaign-audit-batch-v7 .rf-assignment-option input{
        width:15px;
        height:15px;
        min-height:0;
        flex:0 0 15px;
        padding:0;
        margin:0;
        accent-color:var(--rfcab-violet);
      }

      .rf-campaign-audit-batch-v7 .btn{
        width:max-content;
        min-width:150px;
        min-height:39px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 10px;
        border:1px solid transparent;
        border-radius:8px;
        cursor:pointer;
        font:700 6.5px/1 Inter,sans-serif;
        transition:.14s var(--rfcab-ease);
      }

      .rf-campaign-audit-batch-v7 .btn:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rf-campaign-audit-batch-v7 .btn:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rf-campaign-audit-batch-v7 .btn.primary{
        color:#fff;
        background:var(--rfcab-primary);
        border-color:var(--rfcab-primary);
        box-shadow:0 7px 16px rgba(70,72,212,.12);
      }

      .rf-campaign-audit-batch-v7 .btn.primary:hover:not(:disabled){
        background:var(--rfcab-primary-dark);
      }

      .rf-campaign-audit-batch-v7 .text-muted{
        color:var(--rfcab-muted)!important;
      }

      .rf-campaign-audit-batch-v7 .text-xs{
        font-size:5.7px!important;
        line-height:9px!important;
      }

      .rf-campaign-audit-batch-v7 .mt8{
        margin-top:0!important;
      }

      .rf-campaign-audit-batch-v7 .mt16{
        margin-top:0!important;
      }

      .rf-campaign-audit-batch-v7 .rf-audit-job-progress{
        display:grid;
        grid-template-columns:minmax(190px,.8fr) minmax(180px,1fr) 52px;
        align-items:center;
        gap:10px;
        min-height:86px;
        padding:12px;
        color:var(--rfcab-text);
        background:
          linear-gradient(135deg,#f4f1ff,#fff);
        border:1px solid #e1d9f7;
        border-radius:9px;
      }

      .rf-campaign-audit-batch-v7 .rf-audit-job-progress > div{
        min-width:0;
        display:grid;
      }

      .rf-campaign-audit-batch-v7 .rf-audit-job-progress b{
        font-size:6.8px;
      }

      .rf-campaign-audit-batch-v7 .rf-audit-job-progress small{
        margin-top:2px;
        overflow:hidden;
        color:var(--rfcab-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:5.5px;
      }

      .rf-campaign-audit-batch-v7 .rf-audit-job-progress > span{
        height:8px;
        overflow:hidden;
        background:#e7e1f7;
        border-radius:999px;
      }

      .rf-campaign-audit-batch-v7 .rf-audit-job-progress > span > i{
        display:block;
        height:100%;
        background:linear-gradient(90deg,var(--rfcab-primary),var(--rfcab-violet));
        border-radius:inherit;
        transition:width .28s var(--rfcab-ease);
      }

      .rf-campaign-audit-batch-v7 .rf-audit-job-progress > strong{
        color:var(--rfcab-violet);
        text-align:right;
        font-size:10px;
      }

      @media(max-width:720px){
        .rf-campaign-audit-batch-v7 .rf-audit-batch-controls{
          grid-template-columns:1fr;
        }

        .rf-campaign-audit-batch-v7 .rf-audit-job-progress{
          grid-template-columns:1fr;
        }

        .rf-campaign-audit-batch-v7 .rf-audit-job-progress > strong{
          text-align:left;
        }

        .rf-campaign-audit-batch-v7 .btn{
          width:100%;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-campaign-audit-batch-v7,
        .rf-campaign-audit-batch-v7 *,
        .rf-campaign-audit-batch-v7 *::before,
        .rf-campaign-audit-batch-v7 *::after{
          animation:none!important;
          transition-duration:.01ms!important;
        }
      }
    `}</style>
  );
}
