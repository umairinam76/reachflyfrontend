import { useEffect, useMemo, useState } from "react";
import { Brain, Globe2, Sparkles } from "../components/icons";
import { upgradeApi } from "../api/upgradeApi";

export default function WebsiteAudits() {
  const [audits, setAudits] = useState([]);
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState({
    website: "",
    companyName: "",
    niche: "",
    location: "",
    benchmarkUrls: "",
    offer: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const load = () => upgradeApi.audits().then(setAudits).catch(() => {});
  useEffect(() => { load(); }, []);

  const create = async (event) => {
    event.preventDefault();
    try {
      setLoading(true);
      setError("");
      const audit = await upgradeApi.createAudit({
        ...form,
        benchmarkUrls: form.benchmarkUrls.split(/\n|,/).map((item) => item.trim()).filter(Boolean),
      });
      setSelected(audit);
      setAudits((current) => [audit, ...current.filter((item) => item.id !== audit.id)]);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const report = selected?.report;
  const findings = useMemo(() => report?.priorityFindings || [], [report]);

  return (
    <div className="page rf-audits-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Audit agent</span>
          <h1>Generate evidence-grounded website audits.</h1>
          <p>Run deterministic public-page checks, compare detectable features with relevant benchmark sites, and use OpenAI only to structure the findings and outreach narrative.</p>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <div className="rf-audit-layout">
        <section className="cardish">
          <div className="section-title-row">
            <div><span className="eyebrow">New report</span><h2>Website and market context</h2></div>
            <Globe2 />
          </div>

          <form className="rf-audit-form" onSubmit={create}>
            <label className="field"><span>Lead website</span><input value={form.website} onChange={(event) => setForm({ ...form, website: event.target.value })} placeholder="https://exampleclinic.com" required /></label>
            <div className="grid2">
              <label className="field"><span>Company name</span><input value={form.companyName} onChange={(event) => setForm({ ...form, companyName: event.target.value })} /></label>
              <label className="field"><span>Niche</span><input value={form.niche} onChange={(event) => setForm({ ...form, niche: event.target.value })} placeholder="Aesthetic clinic" /></label>
            </div>
            <label className="field"><span>Location</span><input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="New York, NY" /></label>
            <label className="field"><span>Benchmark URLs — optional</span><textarea rows="4" value={form.benchmarkUrls} onChange={(event) => setForm({ ...form, benchmarkUrls: event.target.value })} placeholder="One URL per line. Leave blank to use strong matching websites already verified inside this ReachFly workspace." /></label>
            <label className="field"><span>Your relevant offer</span><input value={form.offer} onChange={(event) => setForm({ ...form, offer: event.target.value })} placeholder="Patient enquiry automation and CRM integration" /></label>
            <button className="btn primary" type="submit" disabled={loading}><Sparkles /> {loading ? "Running checks and writing report…" : "Generate audit"}</button>
          </form>
        </section>

        <aside className="cardish rf-audit-history">
          <div className="section-title-row"><div><span className="eyebrow">History</span><h2>Recent audits</h2></div><Brain /></div>
          {audits.length ? audits.map((audit) => (
            <button key={audit.id} type="button" className={selected?.id === audit.id ? "active" : ""} onClick={() => setSelected(audit)}>
              <b>{audit.companyName || audit.targetUrl}</b>
              <small>{new Date(audit.createdAt).toLocaleString()}</small>
              <span>{audit.report?.score ?? audit.evidence?.target?.rawScore ?? 0}/100</span>
            </button>
          )) : <p className="text-muted">No audits generated yet.</p>}
        </aside>
      </div>

      {selected ? (
        <section className="cardish rf-audit-report mt24">
          <div className="rf-audit-score"><strong>{report?.score ?? selected.evidence?.target?.rawScore ?? 0}</strong><span>Automated score</span></div>
          <div className="rf-audit-report-main">
            <span className="eyebrow">{selected.companyName || selected.targetUrl}</span>
            <h2>{report?.executiveSummary || "Audit complete"}</h2>
            <p className="text-muted">Benchmarks: {(selected.benchmarkUrls || []).join(", ") || "None"}</p>

            <div className="rf-audit-findings">
              {findings.map((item) => (
                <article key={`${item.title}-${item.evidence}`}>
                  <span className={`badge ${severityBadge(item.severity)}`}>{item.severity}</span>
                  <h3>{item.title}</h3>
                  <p><b>Evidence:</b> {item.evidence}</p>
                  <p><b>Business relevance:</b> {item.businessImpact}</p>
                  <p><b>Recommendation:</b> {item.recommendation}</p>
                </article>
              ))}
            </div>

            <div className="grid2 mt24">
              <div className="card"><h3>Cold-call opening</h3><p>{report?.callOpening}</p></div>
              <div className="card"><h3>Follow-up email</h3><b>{report?.emailSubject}</b><pre>{report?.emailBody}</pre></div>
            </div>

            <p className="safe-note-v54 mt16">{report?.disclaimer}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function severityBadge(value) {
  if (value === "critical" || value === "high") return "badge-red";
  if (value === "medium") return "badge-amber";
  return "badge-gray";
}
