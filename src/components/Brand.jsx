import { Send } from "./icons";

export default function Brand({ light = false }) {
  return (
    <div className={`brand ${light ? "brand-light" : ""}`}>
      <div className="brand-mark"><Send className="brand-arrow" size={20} /></div>
      <span><b>ReachFly.Ai</b><small>Growth CRM</small></span>
    </div>
  );
}
