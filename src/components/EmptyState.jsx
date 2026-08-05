import { Inbox } from "./icons";
import { Link } from "react-router-dom";

export default function EmptyState({ title, text, action = "Build a campaign", to = "/app/builder" }) {
  return (
    <div className="empty">
      <span><Inbox /></span>
      <h3>{title}</h3>
      <p>{text}</p>
      <Link className="btn primary" to={to}>{action}</Link>
    </div>
  );
}
