import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { Bot, Check, Plus, Send, Sparkles, Wand2 } from "../components/icons";

const starters = [
  "Create a campaign for dentists in Miami with 100 leads",
  "Show me active campaigns",
  "Help me setup a 3 step email and WhatsApp pipeline",
  "What territories have I already targeted?",
];

export default function ReachFlyAI() {
  const [messages, setMessages] = useState([
    {
      role: "assistant",
      text: "Hi, I’m ReachFly AI. I can help only inside ReachFly: campaigns, pipelines, email setup, WhatsApp setup, metrics, contacts, inbox, and territories.",
    },
  ]);

  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text = input) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;

    setInput("");
    setMessages((current) => current.concat({ role: "user", text: trimmed }));
    setLoading(true);

    try {
      const result = await api.reachflyCommand(trimmed);

      setMessages((current) =>
        current.concat({
          role: "assistant",
          text: result.reply,
          action: result.action,
          campaign: result.campaign,
        })
      );
    } catch (e) {
      setMessages((current) =>
        current.concat({
          role: "assistant",
          text: e.message || "ReachFly could not process that command.",
        })
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ai-page-v54">
      <div className="page-heading">
        <div>
          <span className="eyebrow">ReachFly AI</span>
          <h1>Command your ReachFly workspace.</h1>
          <p>
            Use plain English to create campaigns, understand metrics, build pipelines,
            and navigate setup. It never answers outside your ecosystem.
          </p>
        </div>
      </div>

      <section className="ai-layout-v54">
        <div className="cardish ai-chat-card-v54">
          <div className="ai-chat-header-v54">
            <span>
              <Bot />
            </span>

            <div>
              <b>ReachFly assistant</b>
              <small>
                Restricted to campaigns, leads, pipelines, integrations, metrics,
                and territories.
              </small>
            </div>
          </div>

          <div className="ai-messages-v54">
            {messages.map((message, index) => (
              <div key={index} className={`ai-message-v54 ${message.role}`}>
                <p>{message.text}</p>

                {message.campaign ? (
                  <Link className="btn small" to={`/app/campaigns/${message.campaign.id}`}>
                    Open campaign
                  </Link>
                ) : null}
              </div>
            ))}

            {loading && (
              <div className="ai-message-v54 assistant">
                <p>Thinking inside your ReachFly workspace…</p>
              </div>
            )}

            <div ref={endRef} />
          </div>

          <form
            className="ai-input-v54"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tell ReachFly what to do…"
            />

            <button className="btn primary" type="submit">
              <Send />
            </button>
          </form>
        </div>

        <aside className="cardish ai-side-v54">
          <Sparkles />

          <h2>Safe commands</h2>

          <p>
            ReachFly only helps with your product data and actions. It does not browse
            the open internet or answer unrelated questions.
          </p>

          <div className="starter-list-v54">
            {starters.map((starter) => (
              <button key={starter} onClick={() => send(starter)}>
                <Wand2 /> {starter}
              </button>
            ))}
          </div>

          <div className="safe-note-v54">
            <Check /> Best demo flow: ask it to create a campaign, then open the
            campaign progress screen.
          </div>

          <Link className="btn dark full" to="/app/builder">
            <Plus /> Use visual builder
          </Link>
        </aside>
      </section>
    </div>
  );
}