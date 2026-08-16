import { Link } from "react-router-dom";

const COPY = {
  terms: {
    title: "Terms of Service",
    intro: "These terms govern use of ReachFly.Ai. Your final published legal terms should be reviewed for your company, markets, telephony practices, privacy obligations and payment model before launch.",
  },
  privacy: {
    title: "Privacy Policy",
    intro: "ReachFly.Ai processes workspace, lead, communication and account data to provide the service. Your final published privacy policy should describe your actual processors, retention, lawful bases and regional rights before launch.",
  },
  contact: {
    title: "Contact ReachFly.Ai",
    intro: "For product, billing, account or compliance questions, use the contact method published by your ReachFly.Ai team. Replace this launch placeholder with your monitored support address before production launch.",
  },
};

export default function LegalPage({ kind = "terms" }) {
  const item = COPY[kind] || COPY.terms;
  return (
    <main className="rf-legal-page">
      <header><Link to="/">ReachFly.Ai</Link><span>Launch information</span></header>
      <article>
        <span>{kind === "contact" ? "Support" : "Legal"}</span>
        <h1>{item.title}</h1>
        <p>{item.intro}</p>
        {kind !== "contact" ? (
          <p>
            This page is intentionally a clearly labeled launch placeholder, not fabricated legal advice. Publish counsel-reviewed copy before accepting production customers.
          </p>
        ) : null}
        <nav><Link to="/terms">Terms</Link><Link to="/privacy">Privacy</Link><Link to="/contact">Contact</Link><Link to="/blog">Blog</Link></nav>
      </article>
    </main>
  );
}
