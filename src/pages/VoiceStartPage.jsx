import {
  ArrowRight,
  Bot,
  CheckCircle2,
  Phone,
  Sparkles,
} from "../components/icons";
import {
  Link,
  useSearchParams,
} from "react-router-dom";

export default function VoiceStartPage() {
  const [searchParams] =
    useSearchParams();

  const onboarding =
    searchParams.get("onboarding") === "1";

  const modeHref = (mode) =>
    `/app/voice-agent?tab=setup&view=calling&mode=${mode}${
      onboarding ? "&onboarding=1" : ""
    }`;

  return (
    <>
      <VoiceStartStyles />

      <main className="rf-voice-start-v9">
        <header className="rfvs-head">
          <span>
            <Sparkles size={14} />
            {onboarding ? "Workspace created" : "AI Voice"}
          </span>

          <h1>How do you want ReachFly to handle calls?</h1>

          <p>
            Choose your starting direction. You can change the
            calling mode later from AI Agent setup.
          </p>
        </header>

        {onboarding ? (
          <section className="rfvs-credit-note">
            <span>
              <Sparkles size={15} />
            </span>
            <div>
              <strong>Your 10 free ReachFly credits are ready.</strong>
              <p>
                Use them to try metered ReachFly features before
                choosing a paid credit balance.
              </p>
            </div>
          </section>
        ) : null}

        <section className="rfvs-grid">
          <Link className="rfvs-card inbound" to={modeHref("inbound")}>
            <div className="rfvs-card-icon">
              <Phone size={25} />
              <i>↓</i>
            </div>
            <span className="rfvs-kicker">Inbound AI</span>
            <h2>Answer incoming calls</h2>
            <p>
              Set up an AI phone experience for reception,
              qualification, booking, support, and caller intake.
            </p>
            <ul>
              <li><CheckCircle2 size={15} /> Incoming business calls</li>
              <li><CheckCircle2 size={15} /> Qualification and booking</li>
              <li><CheckCircle2 size={15} /> Business-number routing</li>
            </ul>
            <strong className="rfvs-cta">
              Set up inbound
              <ArrowRight size={16} />
            </strong>
          </Link>

          <Link className="rfvs-card outbound" to={modeHref("outbound")}>
            <div className="rfvs-card-icon">
              <Bot size={25} />
              <i>↑</i>
            </div>
            <span className="rfvs-kicker">Outbound AI</span>
            <h2>Call leads and prospects</h2>
            <p>
              Configure AI-assisted qualification, callbacks,
              follow-up, and meeting-booking workflows.
            </p>
            <ul>
              <li><CheckCircle2 size={15} /> Lead and prospect calling</li>
              <li><CheckCircle2 size={15} /> Follow-up and qualification</li>
              <li><CheckCircle2 size={15} /> Meeting-booking workflows</li>
            </ul>
            <strong className="rfvs-cta">
              Set up outbound
              <ArrowRight size={16} />
            </strong>
          </Link>
        </section>

        <footer className="rfvs-footer">
          <span>Already configured?</span>
          <Link to="/app/agents">
            Open AI Agents
            <ArrowRight size={13} />
          </Link>
        </footer>
      </main>
    </>
  );
}

function VoiceStartStyles() {
  return (
    <style>{`
      .rf-voice-start-v9,.rf-voice-start-v9 *{box-sizing:border-box}
      .rf-voice-start-v9{
        width:min(1120px,100%);
        margin:0 auto;
        padding:26px 24px 42px;
        color:#20222d;
      }
      .rfvs-head{
        max-width:720px;
        margin:18px auto 20px;
        text-align:center;
      }
      .rfvs-head>span{
        min-height:27px;display:inline-flex;align-items:center;gap:6px;
        padding:4px 9px;border:1px solid #dfdef8;border-radius:999px;
        color:#5755d8;background:#f3f2ff;font-size:9px;font-weight:800;
        letter-spacing:.05em;text-transform:uppercase;
      }
      .rfvs-head h1{
        margin:11px 0 0;color:#1d1f29;font-family:Geist,Inter,sans-serif;
        font-size:clamp(30px,4vw,48px);line-height:1.04;letter-spacing:-.04em;
      }
      .rfvs-head p{
        max-width:610px;margin:10px auto 0;color:#747582;
        font-size:13px;line-height:20px;
      }
      .rfvs-credit-note{
        max-width:760px;display:flex;align-items:center;gap:10px;
        margin:0 auto 18px;padding:12px 14px;border:1px solid #dfe2e3;
        border-radius:13px;background:#fff;box-shadow:0 7px 20px rgba(30,34,48,.035);
      }
      .rfvs-credit-note>span{
        width:34px;height:34px;flex:0 0 34px;display:grid;place-items:center;
        border-radius:10px;color:#5756d7;background:#eeeeff;
      }
      .rfvs-credit-note strong{color:#343640;font-size:11px}
      .rfvs-credit-note p{margin:2px 0 0;color:#7f808b;font-size:9px;line-height:14px}
      .rfvs-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
      .rfvs-card{
        position:relative;min-height:390px;display:flex;flex-direction:column;
        padding:27px;overflow:hidden;border:1px solid #e1e2e7;border-radius:20px;
        color:inherit;background:radial-gradient(circle at 100% 0,rgba(92,82,231,.09),transparent 42%),linear-gradient(180deg,#fff 0%,#fbfbfd 100%);
        box-shadow:0 14px 38px rgba(28,31,52,.06);text-decoration:none;
        transition:transform .18s ease,border-color .18s ease,box-shadow .18s ease;
      }
      .rfvs-card:hover{transform:translateY(-3px);border-color:#cfcee9;box-shadow:0 20px 46px rgba(28,31,52,.09)}
      .rfvs-card.outbound{background:radial-gradient(circle at 100% 0,rgba(134,82,222,.1),transparent 42%),linear-gradient(180deg,#fff 0%,#fcfbff 100%)}
      .rfvs-card-icon{
        width:54px;height:54px;position:relative;display:grid;place-items:center;
        margin-bottom:18px;border-radius:15px;color:#5557d8;background:#efefff;
      }
      .rfvs-card-icon i{
        position:absolute;right:-5px;bottom:-5px;width:22px;height:22px;
        display:grid;place-items:center;border:3px solid #fff;border-radius:50%;
        color:#fff;background:#5557d8;font-size:11px;font-style:normal;font-weight:900;
      }
      .rfvs-kicker{color:#7c7d88;font-size:9px;font-weight:800;letter-spacing:.07em;text-transform:uppercase}
      .rfvs-card h2{margin:5px 0 0;color:#22242e;font-family:Geist,Inter,sans-serif;font-size:24px;letter-spacing:-.025em}
      .rfvs-card>p{min-height:60px;margin:8px 0 0;color:#747681;font-size:11px;line-height:17px}
      .rfvs-card ul{display:grid;gap:9px;margin:19px 0 22px;padding:17px 0 0;border-top:1px solid #ececf1;list-style:none}
      .rfvs-card li{display:flex;align-items:center;gap:8px;color:#565863;font-size:10px}
      .rfvs-card li svg{color:#5558d8}
      .rfvs-cta{
        min-height:43px;display:flex;align-items:center;justify-content:space-between;
        gap:10px;margin-top:auto;padding:0 14px;border-radius:11px;color:#fff;
        background:linear-gradient(135deg,#5558e8,#8054df);font-size:11px;
        box-shadow:0 8px 19px rgba(81,83,213,.18);
      }
      .rfvs-footer{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:18px;color:#85858f;font-size:9px}
      .rfvs-footer a{display:inline-flex;align-items:center;gap:4px;color:#5557d8;text-decoration:none;font-weight:800}
      @media(max-width:760px){
        .rf-voice-start-v9{padding:18px 14px 34px}
        .rfvs-grid{grid-template-columns:1fr}
        .rfvs-card{min-height:340px}
      }
    `}</style>
  );
}
