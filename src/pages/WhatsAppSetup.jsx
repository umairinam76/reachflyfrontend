import { useEffect, useState } from "react";
import { api } from "../api";
import { Check, MessageCircle, QrCode, Shield, Sparkles } from "../components/icons";

export default function WhatsAppSetup() {
  const [status, setStatus] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const load = () => api.whatsappStatus().then(setStatus).catch((e) => setError(e.message));
  useEffect(() => { load(); const timer = setInterval(load, 5000); return () => clearInterval(timer); }, []);
  const connect = async () => { try { setLoading(true); setError(""); setMessage(""); const next = await api.whatsappConnect(); setStatus(next); setMessage(next.mode === "demo" ? "Demo QR generated. Install/enable whatsapp-web.js for live linking." : "WhatsApp linking started. Scan the QR code."); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  const logout = async () => { try { setLoading(true); setError(""); const next = await api.whatsappLogout(); setStatus(next); setMessage("WhatsApp session disconnected."); } catch (e) { setError(e.message); } finally { setLoading(false); } };
  return <div className="setup-page-v54"><div className="page-heading"><div><span className="eyebrow">WhatsApp setup</span><h1>Link WhatsApp Web for follow-ups.</h1><p>Show a QR code, manage sessions, and keep WhatsApp outreach separate from email campaigns.</p></div></div>{error && <p className="error-banner">{error}</p>}{message && <p className="success-banner"><Check /> {message}</p>}<section className="setup-layout-v54"><div className="cardish setup-main-card whatsapp-card-v54"><div className="whatsapp-status-v54"><span className={status?.ready ? "ready" : "pending"}><MessageCircle /></span><div><b>{status?.ready ? "WhatsApp linked" : "WhatsApp not linked"}</b><small>{status?.message || "Start a session and scan the QR code from your phone."}</small></div></div><div className="qr-frame-v54">{status?.qr ? <img src={status.qr} alt="WhatsApp QR" /> : <div><QrCode size={80} /><span>QR code appears here</span></div>}</div><div className="setup-actions-v54"><button className="btn primary" disabled={loading} onClick={connect}>{loading ? "Starting…" : "Generate QR / connect"}</button><button className="btn" disabled={loading} onClick={logout}>Logout session</button></div></div><aside className="cardish setup-guide-card"><Sparkles /><h2>How users link WhatsApp</h2><ol><li>Click Generate QR.</li><li>Open WhatsApp on the phone.</li><li>Tap Linked devices.</li><li>Scan the QR code.</li><li>Keep the session active for follow-ups.</li></ol><div className="safe-note-v54"><Shield /> Use responsible outreach and respect platform limits, consent, and local laws.</div></aside></section></div>;
}
