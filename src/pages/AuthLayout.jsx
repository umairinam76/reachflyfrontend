import { Link } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import { CheckCircle2 } from "../components/icons";

export default function AuthLayout({ eyebrow, title, text, children, footer }) {
  return (
    <main className="rf-auth-page">
      <section className="rf-auth-shell">
        <aside className="rf-auth-hero">
          <Link className="rf-auth-brand" to="/">
            <BrandLogo size={44} />
            <b>ReachFly.Ai</b>
          </Link>

          <div className="rf-auth-copy">
            <span className="rf-auth-eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{text}</p>
          </div>

          <div className="rf-auth-proof">
            {[
              "Lead discovery",
              "Website audits",
              "Email outreach",
              "WhatsApp follow-ups",
              "Campaign CRM",
            ].map((item) => (
              <span key={item}>
                <CheckCircle2 size={15} /> {item}
              </span>
            ))}
          </div>
        </aside>

        <section className="rf-auth-panel">
          <div className="rf-auth-card">{children}</div>
          {footer ? <div className="rf-auth-footer">{footer}</div> : null}
        </section>
      </section>
    </main>
  );
}