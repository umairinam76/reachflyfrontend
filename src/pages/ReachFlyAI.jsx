import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  api,
} from "../api";

import {
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Plus,
  RefreshCw,
  Search,
  Send,
  Shield,
  Sparkles,
  Target,
  Wand2,
  Workflow,
  X,
  Zap,
} from "../components/icons";

const STARTERS = [
  {
    icon: Target,
    title: "Create a campaign",
    prompt:
      "Create a campaign for dentists in Miami with 100 leads",
  },
  {
    icon: Search,
    title: "Review active campaigns",
    prompt:
      "Show me active campaigns",
  },
  {
    icon: Workflow,
    title: "Build a follow-up flow",
    prompt:
      "Help me setup a 3 step email and WhatsApp pipeline",
  },
  {
    icon: Target,
    title: "Review targeted markets",
    prompt:
      "What territories have I already targeted?",
  },
];

const INITIAL_MESSAGE = {
  role:
    "assistant",
  text:
    "Hi, I’m ReachFly AI. I can help inside your ReachFly workspace with campaigns, pipelines, email setup, WhatsApp setup, metrics, contacts, inbox, and territories.",
};

export default function ReachFlyAI() {
  const [
    messages,
    setMessages,
  ] = useState([
    INITIAL_MESSAGE,
  ]);

  const [
    input,
    setInput,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    lastError,
    setLastError,
  ] = useState("");

  const endRef =
    useRef(null);

  const inputRef =
    useRef(null);

  useEffect(
    () => {
      endRef.current?.scrollIntoView({
        behavior:
          "smooth",
        block:
          "nearest",
      });
    },
    [
      loading,
      messages,
    ]
  );

  const conversationCount =
    useMemo(
      () =>
        messages.filter(
          (
            message
          ) =>
            message.role ===
            "user"
        ).length,
      [
        messages,
      ]
    );

  const hasCampaignAction =
    useMemo(
      () =>
        messages.some(
          (
            message
          ) =>
            Boolean(
              message.campaign?.id
            )
        ),
      [
        messages,
      ]
    );

  async function send(
    text = input
  ) {
    const trimmed =
      String(
        text ||
          ""
      ).trim();

    if (
      !trimmed ||
      loading
    ) {
      return;
    }

    setInput("");
    setLastError("");

    setMessages(
      (
        current
      ) =>
        current.concat({
          role:
            "user",
          text:
            trimmed,
        })
    );

    setLoading(
      true
    );

    try {
      const result =
        await api.reachflyCommand(
          trimmed
        );

      const reply =
        String(
          result?.reply ||
            result?.message ||
            "ReachFly completed the command."
        ).trim();

      setMessages(
        (
          current
        ) =>
          current.concat({
            role:
              "assistant",
            text:
              reply,
            action:
              result?.action ||
              null,
            campaign:
              result?.campaign ||
              null,
          })
      );

      if (
        result?.campaign?.id
      ) {
        notify(
          "success",
          "Campaign ready",
          "ReachFly AI created or updated a campaign you can open now."
        );
      }
    } catch (
      requestError
    ) {
      const message =
        safeMessage(
          requestError?.message ||
            "ReachFly could not process that command."
        );

      setLastError(
        message
      );

      setMessages(
        (
          current
        ) =>
          current.concat({
            role:
              "assistant",
            text:
              message,
            error:
              true,
          })
      );

      notify(
        "error",
        "ReachFly AI couldn't complete that",
        message
      );
    } finally {
      setLoading(
        false
      );

      window.setTimeout(
        () =>
          inputRef.current?.focus(),
        0
      );
    }
  }

  function resetConversation() {
    if (
      loading
    ) {
      return;
    }

    setMessages([
      INITIAL_MESSAGE,
    ]);
    setLastError("");
    setInput("");

    notify(
      "info",
      "Conversation cleared",
      "A fresh ReachFly AI conversation is ready."
    );

    window.setTimeout(
      () =>
        inputRef.current?.focus(),
      0
    );
  }

  return (
    <>
      <ReachFlyAIStyles />

      <main className="rf-ai-v7">
        <header className="rfai-page-header">
          <div>
            <span className="rfai-eyebrow">
              ReachFly AI
            </span>

            <h1>
              Command your sales workspace.
            </h1>

            <p>
              Use plain English to work with campaigns, metrics, pipelines,
              setup, contacts, inbox activity, and territory context already
              available inside ReachFly.
            </p>
          </div>

          <div className="rfai-header-actions">
            <div className="rfai-session-pill">
              <span>
                <Sparkles size={13} />
              </span>

              <div>
                <small>
                  Current session
                </small>

                <strong>
                  {conversationCount}{" "}
                  {conversationCount ===
                  1
                    ? "command"
                    : "commands"}
                </strong>
              </div>
            </div>

            <button
              type="button"
              className="rfai-button secondary"
              disabled={
                loading ||
                messages.length <=
                  1
              }
              onClick={
                resetConversation
              }
            >
              <RefreshCw size={14} />
              New conversation
            </button>
          </div>
        </header>

        {lastError ? (
          <section
            className="rfai-alert"
            role="alert"
          >
            <span>
              <X size={13} />
            </span>

            <div>
              <strong>
                The latest command could not be completed
              </strong>

              <p>
                {lastError}
              </p>
            </div>

            <button
              type="button"
              onClick={() =>
                setLastError(
                  ""
                )
              }
              aria-label="Dismiss ReachFly AI error"
            >
              <X size={11} />
            </button>
          </section>
        ) : null}

        <section className="rfai-layout">
          <section className="rfai-chat-card">
            <header className="rfai-chat-header">
              <span className="rfai-assistant-mark">
                <Bot size={19} />
              </span>

              <div>
                <strong>
                  ReachFly assistant
                </strong>

                <small>
                  Workspace-restricted sales operations assistant
                </small>
              </div>

              <span className="rfai-online">
                <i />
                Ready
              </span>
            </header>

            <div
              className="rfai-messages"
              aria-live="polite"
            >
              {messages.map(
                (
                  message,
                  index
                ) => (
                  <MessageBubble
                    key={
                      `${message.role}-${index}`
                    }
                    message={
                      message
                    }
                  />
                )
              )}

              {loading ? (
                <div className="rfai-message assistant thinking">
                  <span className="rfai-message-avatar">
                    <Bot size={13} />
                  </span>

                  <div className="rfai-message-content">
                    <small>
                      ReachFly AI
                    </small>

                    <div className="rfai-thinking">
                      <i />
                      <i />
                      <i />

                      <span>
                        Working inside your workspace…
                      </span>
                    </div>
                  </div>
                </div>
              ) : null}

              <div ref={endRef} />
            </div>

            <form
              className="rfai-composer"
              onSubmit={(
                event
              ) => {
                event.preventDefault();
                void send();
              }}
            >
              <div className="rfai-composer-input">
                <Sparkles size={15} />

                <textarea
                  ref={inputRef}
                  value={
                    input
                  }
                  onChange={(
                    event
                  ) =>
                    setInput(
                      event.target
                        .value
                    )
                  }
                  onKeyDown={(
                    event
                  ) => {
                    if (
                      event.key ===
                        "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  placeholder="Tell ReachFly what to do…"
                  rows={1}
                  disabled={
                    loading
                  }
                />

                <button
                  type="submit"
                  disabled={
                    loading ||
                    !input.trim()
                  }
                  aria-label="Send ReachFly AI command"
                >
                  {loading ? (
                    <RefreshCw
                      size={15}
                      className="rfai-spin"
                    />
                  ) : (
                    <Send size={15} />
                  )}
                </button>
              </div>

              <footer>
                <span>
                  Press Enter to send · Shift + Enter for a new line
                </span>

                <span>
                  <Shield size={11} />
                  Restricted to ReachFly workspace actions
                </span>
              </footer>
            </form>
          </section>

          <aside className="rfai-side">
            <section className="rfai-side-card rfai-scope-card">
              <header>
                <span>
                  <Shield size={16} />
                </span>

                <div>
                  <small>
                    Safe command scope
                  </small>

                  <strong>
                    Works inside ReachFly
                  </strong>
                </div>
              </header>

              <p>
                ReachFly AI is designed for your product data and supported
                workspace actions. It is not presented as an open-web research
                assistant.
              </p>

              <div className="rfai-scope-list">
                {[
                  "Campaigns",
                  "Pipelines",
                  "Contacts",
                  "Inbox",
                  "Metrics",
                  "Territories",
                ].map(
                  (
                    item
                  ) => (
                    <span key={item}>
                      <Check size={10} />
                      {item}
                    </span>
                  )
                )}
              </div>
            </section>

            <section className="rfai-side-card">
              <header>
                <span className="violet">
                  <Wand2 size={16} />
                </span>

                <div>
                  <small>
                    Suggested commands
                  </small>

                  <strong>
                    Start with a real workflow
                  </strong>
                </div>
              </header>

              <div className="rfai-starters">
                {STARTERS.map(
                  (
                    starter
                  ) => {
                    const Icon =
                      starter.icon;

                    return (
                      <button
                        type="button"
                        key={
                          starter.prompt
                        }
                        disabled={
                          loading
                        }
                        onClick={() =>
                          void send(
                            starter.prompt
                          )
                        }
                      >
                        <span>
                          <Icon size={14} />
                        </span>

                        <div>
                          <strong>
                            {starter.title}
                          </strong>

                          <small>
                            {starter.prompt}
                          </small>
                        </div>

                        <ChevronRight size={12} />
                      </button>
                    );
                  }
                )}
              </div>
            </section>

            <section className="rfai-side-card rfai-builder-card">
              <span>
                <Zap size={17} />
              </span>

              <div>
                <small>
                  Prefer a visual workflow?
                </small>

                <strong>
                  Use the lead builder
                </strong>

                <p>
                  Configure a market, lead volume, and campaign flow using the
                  structured builder instead.
                </p>
              </div>

              <Link
                className="rfai-button dark full"
                to="/app/builder"
              >
                <Plus size={13} />
                Open visual builder
              </Link>
            </section>

            {hasCampaignAction ? (
              <section className="rfai-side-card rfai-success-card">
                <CheckCircle2 size={18} />

                <div>
                  <strong>
                    Campaign action available
                  </strong>

                  <p>
                    A ReachFly AI response in this conversation includes a real
                    campaign link.
                  </p>
                </div>
              </section>
            ) : null}
          </aside>
        </section>
      </main>
    </>
  );
}

function MessageBubble({
  message,
}) {
  const isUser =
    message.role ===
    "user";

  return (
    <div
      className={`rfai-message ${
        isUser
          ? "user"
          : "assistant"
      } ${
        message.error
          ? "error"
          : ""
      }`}
    >
      <span className="rfai-message-avatar">
        {isUser ? (
          <Target size={13} />
        ) : (
          <Bot size={13} />
        )}
      </span>

      <div className="rfai-message-content">
        <small>
          {isUser
            ? "You"
            : "ReachFly AI"}
        </small>

        <p>
          {message.text}
        </p>

        {message.campaign?.id ? (
          <Link
            className="rfai-action-link"
            to={`/app/campaigns/${encodeURIComponent(
              message.campaign.id
            )}`}
          >
            Open campaign
            <ArrowIcon />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function ArrowIcon() {
  return (
    <ChevronRight size={12} />
  );
}

function safeMessage(
  value
) {
  return String(
    value ||
      ""
  )
    .replace(
      /ElevenLabs/gi,
      "voice service"
    )
    .replace(
      /Telnyx/gi,
      "calling service"
    )
    .replace(
      /\bSIP\b/gi,
      "voice connection"
    );
}

function notify(
  type,
  title,
  message
) {
  if (
    typeof window ===
    "undefined"
  ) {
    return;
  }

  const bridge =
    window.reachflyToast;

  if (
    bridge &&
    typeof bridge[
      type
    ] ===
      "function"
  ) {
    bridge[
      type
    ](
      title,
      message
    );

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

function ReachFlyAIStyles() {
  return (
    <style>{`
      .rf-ai-v7{
        --rfai-card:#fff;
        --rfai-soft:#f3f4f5;
        --rfai-text:#191c1d;
        --rfai-text2:#4c4b59;
        --rfai-muted:#777784;
        --rfai-line:#e2e4e7;
        --rfai-primary:#4648d4;
        --rfai-primary-dark:#3739bd;
        --rfai-primary-soft:#e8e9ff;
        --rfai-violet:#6b38d4;
        --rfai-violet-soft:#f0eaff;
        --rfai-green:#087a51;
        --rfai-green-soft:#dff8eb;
        --rfai-red:#ba1a1a;
        --rfai-red-soft:#ffedeb;
        --rfai-dark:#2e3132;
        --rfai-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 42px;
        color:var(--rfai-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfaiPageIn .24s var(--rfai-ease);
      }

      .rf-ai-v7 *,
      .rf-ai-v7 *::before,
      .rf-ai-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfaiPageIn{
        from{opacity:0;transform:translateY(5px)}
        to{opacity:1;transform:none}
      }

      @keyframes rfaiDot{
        0%,80%,100%{transform:translateY(0);opacity:.35}
        40%{transform:translateY(-3px);opacity:1}
      }

      @keyframes rfaiSpin{
        to{transform:rotate(360deg)}
      }

      .rfai-spin{
        animation:rfaiSpin .75s linear infinite;
      }

      .rfai-page-header{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:22px;
        margin-bottom:17px;
      }

      .rfai-eyebrow{
        display:block;
        margin-bottom:4px;
        color:var(--rfai-primary);
        font-size:9px;
        font-weight:800;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rfai-page-header h1{
        margin:0;
        font:600 32px/40px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rfai-page-header p{
        max-width:760px;
        margin:4px 0 0;
        color:var(--rfai-text2);
        font-size:12px;
        line-height:18px;
      }

      .rfai-header-actions{
        display:flex;
        align-items:center;
        gap:8px;
      }

      .rfai-session-pill{
        min-height:45px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:7px 10px;
        background:#fff;
        border:1px solid var(--rfai-line);
        border-radius:9px;
      }

      .rfai-session-pill > span{
        width:29px;
        height:29px;
        display:grid;
        place-items:center;
        color:var(--rfai-primary);
        background:var(--rfai-primary-soft);
        border-radius:7px;
      }

      .rfai-session-pill > div{
        display:grid;
      }

      .rfai-session-pill small{
        color:var(--rfai-muted);
        font-size:6px;
      }

      .rfai-session-pill strong{
        font-size:7px;
      }

      .rfai-button{
        min-height:39px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 10px;
        border:1px solid transparent;
        border-radius:8px;
        cursor:pointer;
        text-decoration:none;
        font-size:7px;
        font-weight:700;
        transition:.14s var(--rfai-ease);
      }

      .rfai-button:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rfai-button:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rfai-button.secondary{
        color:var(--rfai-text);
        background:#fff;
        border-color:var(--rfai-line);
      }

      .rfai-button.dark{
        color:#fff;
        background:var(--rfai-dark);
      }

      .rfai-button.full{
        width:100%;
      }

      .rfai-alert{
        display:grid;
        grid-template-columns:27px minmax(0,1fr) 24px;
        align-items:start;
        gap:8px;
        padding:10px 11px;
        margin-bottom:11px;
        color:#7f1b1b;
        background:var(--rfai-red-soft);
        border:1px solid #ffd0cc;
        border-radius:9px;
      }

      .rfai-alert > span{
        width:27px;
        height:27px;
        display:grid;
        place-items:center;
        background:#fff;
        border-radius:7px;
      }

      .rfai-alert strong{
        display:block;
        font-size:7px;
      }

      .rfai-alert p{
        margin:1px 0 0;
        font-size:7px;
        line-height:11px;
      }

      .rfai-alert > button{
        width:24px;
        height:24px;
        display:grid;
        place-items:center;
        padding:0;
        color:currentColor;
        background:transparent;
        border:0;
        border-radius:6px;
        cursor:pointer;
      }

      .rfai-layout{
        display:grid;
        grid-template-columns:minmax(0,1fr) 315px;
        align-items:start;
        gap:15px;
      }

      .rfai-chat-card,
      .rfai-side-card{
        background:#fff;
        border:1px solid var(--rfai-line);
        border-radius:13px;
        box-shadow:0 1px 3px rgba(25,28,29,.03);
      }

      .rfai-chat-card{
        min-height:650px;
        display:grid;
        grid-template-rows:auto minmax(0,1fr) auto;
        overflow:hidden;
      }

      .rfai-chat-header{
        min-height:77px;
        display:grid;
        grid-template-columns:39px minmax(0,1fr) auto;
        align-items:center;
        gap:9px;
        padding:13px 15px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rfai-line);
      }

      .rfai-assistant-mark{
        width:39px;
        height:39px;
        display:grid;
        place-items:center;
        color:#fff;
        background:linear-gradient(135deg,#5557df,#4648d4);
        border-radius:10px;
        box-shadow:0 7px 16px rgba(70,72,212,.15);
      }

      .rfai-chat-header > div{
        display:grid;
      }

      .rfai-chat-header strong{
        font:600 10px/14px Geist,Inter,sans-serif;
      }

      .rfai-chat-header small{
        margin-top:1px;
        color:var(--rfai-muted);
        font-size:6.5px;
      }

      .rfai-online{
        display:flex;
        align-items:center;
        gap:5px;
        padding:5px 7px;
        color:var(--rfai-green);
        background:var(--rfai-green-soft);
        border-radius:999px;
        font-size:6px;
        font-weight:750;
      }

      .rfai-online i{
        width:6px;
        height:6px;
        background:currentColor;
        border-radius:50%;
      }

      .rfai-messages{
        max-height:560px;
        overflow:auto;
        display:grid;
        align-content:start;
        gap:13px;
        padding:18px;
        background:
          radial-gradient(circle at 95% 10%,rgba(70,72,212,.04),transparent 28%),
          #fff;
      }

      .rfai-message{
        max-width:78%;
        display:grid;
        grid-template-columns:31px minmax(0,1fr);
        align-items:start;
        gap:8px;
      }

      .rfai-message.user{
        justify-self:end;
        grid-template-columns:minmax(0,1fr) 31px;
      }

      .rfai-message.user .rfai-message-avatar{
        grid-column:2;
      }

      .rfai-message.user .rfai-message-content{
        grid-column:1;
        grid-row:1;
        color:#fff;
        background:var(--rfai-primary);
        border-color:var(--rfai-primary);
      }

      .rfai-message-avatar{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        color:var(--rfai-primary);
        background:var(--rfai-primary-soft);
        border-radius:8px;
      }

      .rfai-message.user .rfai-message-avatar{
        color:#fff;
        background:var(--rfai-dark);
      }

      .rfai-message-content{
        min-width:0;
        padding:10px 11px;
        background:#f6f7f8;
        border:1px solid #edefef;
        border-radius:10px;
      }

      .rfai-message.error .rfai-message-content{
        background:var(--rfai-red-soft);
        border-color:#ffd6d2;
      }

      .rfai-message-content > small{
        display:block;
        margin-bottom:3px;
        color:var(--rfai-muted);
        font-size:5.5px;
        font-weight:750;
        text-transform:uppercase;
      }

      .rfai-message.user .rfai-message-content > small{
        color:rgba(255,255,255,.63);
      }

      .rfai-message-content > p{
        margin:0;
        color:var(--rfai-text2);
        white-space:pre-wrap;
        font-size:8px;
        line-height:14px;
      }

      .rfai-message.user .rfai-message-content > p{
        color:#fff;
      }

      .rfai-action-link{
        width:max-content;
        display:inline-flex;
        align-items:center;
        gap:4px;
        margin-top:8px;
        padding:6px 8px;
        color:var(--rfai-primary)!important;
        background:#fff;
        border:1px solid #dfe0ff;
        border-radius:7px;
        text-decoration:none;
        font-size:6.5px;
        font-weight:750;
      }

      .rfai-thinking{
        display:flex;
        align-items:center;
        gap:4px;
      }

      .rfai-thinking > i{
        width:5px;
        height:5px;
        background:var(--rfai-primary);
        border-radius:50%;
        animation:rfaiDot 1s infinite ease-in-out;
      }

      .rfai-thinking > i:nth-child(2){
        animation-delay:.12s;
      }

      .rfai-thinking > i:nth-child(3){
        animation-delay:.24s;
      }

      .rfai-thinking > span{
        margin-left:4px;
        color:var(--rfai-muted);
        font-size:6.5px;
      }

      .rfai-composer{
        padding:12px 14px 13px;
        background:#fbfbfc;
        border-top:1px solid var(--rfai-line);
      }

      .rfai-composer-input{
        min-height:50px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:5px 6px 5px 10px;
        color:#8b8c95;
        background:#fff;
        border:1px solid var(--rfai-line);
        border-radius:10px;
      }

      .rfai-composer-input:focus-within{
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.07);
      }

      .rfai-composer textarea{
        min-width:0;
        width:100%;
        max-height:110px;
        resize:none;
        padding:9px 0;
        color:var(--rfai-text);
        background:transparent;
        border:0;
        outline:0;
        font:400 8px/13px Inter,sans-serif;
      }

      .rfai-composer-input > button{
        width:38px;
        height:38px;
        display:grid;
        place-items:center;
        flex:0 0 38px;
        padding:0;
        color:#fff;
        background:var(--rfai-primary);
        border:0;
        border-radius:8px;
        cursor:pointer;
      }

      .rfai-composer-input > button:disabled{
        opacity:.4;
        cursor:not-allowed;
      }

      .rfai-composer footer{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:7px 2px 0;
        color:var(--rfai-muted);
        font-size:5.5px;
      }

      .rfai-composer footer span:last-child{
        display:flex;
        align-items:center;
        gap:4px;
      }

      .rfai-side{
        position:sticky;
        top:78px;
        display:grid;
        gap:11px;
      }

      .rfai-side-card{
        overflow:hidden;
        padding:13px;
      }

      .rfai-side-card > header{
        display:grid;
        grid-template-columns:34px minmax(0,1fr);
        align-items:center;
        gap:8px;
        margin-bottom:9px;
      }

      .rfai-side-card > header > span{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        color:var(--rfai-primary);
        background:var(--rfai-primary-soft);
        border-radius:8px;
      }

      .rfai-side-card > header > span.violet{
        color:var(--rfai-violet);
        background:var(--rfai-violet-soft);
      }

      .rfai-side-card > header > div{
        display:grid;
      }

      .rfai-side-card > header small{
        color:var(--rfai-muted);
        font-size:5.5px;
        text-transform:uppercase;
      }

      .rfai-side-card > header strong{
        font-size:7.5px;
      }

      .rfai-side-card > p{
        margin:0;
        color:var(--rfai-text2);
        font-size:6.7px;
        line-height:11px;
      }

      .rfai-scope-card{
        background:
          linear-gradient(135deg,#fbfbff,#f6f6ff);
        border-color:#dfdfff;
      }

      .rfai-scope-list{
        display:flex;
        flex-wrap:wrap;
        gap:5px;
        margin-top:10px;
      }

      .rfai-scope-list span{
        display:flex;
        align-items:center;
        gap:4px;
        padding:5px 6px;
        color:var(--rfai-primary);
        background:#fff;
        border:1px solid #e1e1ff;
        border-radius:999px;
        font-size:5.5px;
        font-weight:700;
      }

      .rfai-starters{
        display:grid;
        gap:6px;
      }

      .rfai-starters button{
        min-height:59px;
        display:grid;
        grid-template-columns:31px minmax(0,1fr) 16px;
        align-items:center;
        gap:7px;
        width:100%;
        padding:7px;
        color:inherit;
        background:#f6f7f8;
        border:1px solid transparent;
        border-radius:8px;
        text-align:left;
        cursor:pointer;
        transition:.13s var(--rfai-ease);
      }

      .rfai-starters button:hover:not(:disabled){
        background:#f0f0fb;
        border-color:#ddddff;
      }

      .rfai-starters button:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rfai-starters button > span{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        color:var(--rfai-primary);
        background:#fff;
        border-radius:7px;
      }

      .rfai-starters button > div{
        min-width:0;
      }

      .rfai-starters strong{
        display:block;
        font-size:6.5px;
      }

      .rfai-starters small{
        display:block;
        margin-top:1px;
        overflow:hidden;
        color:var(--rfai-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:5.5px;
      }

      .rfai-starters button > svg{
        color:#a0a1aa;
      }

      .rfai-builder-card{
        display:grid;
        grid-template-columns:34px minmax(0,1fr);
        gap:8px;
      }

      .rfai-builder-card > span{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        color:#fff;
        background:var(--rfai-dark);
        border-radius:8px;
      }

      .rfai-builder-card > div{
        min-width:0;
      }

      .rfai-builder-card small{
        display:block;
        color:var(--rfai-muted);
        font-size:5.5px;
        text-transform:uppercase;
      }

      .rfai-builder-card strong{
        display:block;
        margin-top:1px;
        font-size:7.5px;
      }

      .rfai-builder-card p{
        margin:3px 0 0;
        color:var(--rfai-muted);
        font-size:6px;
        line-height:10px;
      }

      .rfai-builder-card .rfai-button{
        grid-column:1/-1;
        margin-top:3px;
      }

      .rfai-success-card{
        display:grid;
        grid-template-columns:31px minmax(0,1fr);
        gap:8px;
        color:var(--rfai-green);
        background:var(--rfai-green-soft);
        border-color:#c9ead9;
      }

      .rfai-success-card > svg{
        margin-top:1px;
      }

      .rfai-success-card strong{
        display:block;
        font-size:6.5px;
      }

      .rfai-success-card p{
        margin:2px 0 0;
        color:#3f6b5d;
        font-size:5.8px;
        line-height:10px;
      }

      @media(max-width:1050px){
        .rf-ai-v7{
          padding:22px;
        }

        .rfai-layout{
          grid-template-columns:minmax(0,1fr) 280px;
        }
      }

      @media(max-width:880px){
        .rfai-page-header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfai-header-actions{
          width:100%;
        }

        .rfai-layout{
          grid-template-columns:1fr;
        }

        .rfai-side{
          position:static;
          grid-template-columns:1fr 1fr;
        }

        .rfai-builder-card,
        .rfai-success-card{
          align-self:stretch;
        }
      }

      @media(max-width:640px){
        .rf-ai-v7{
          padding:18px 12px 80px;
        }

        .rfai-page-header h1{
          font-size:25px;
          line-height:32px;
        }

        .rfai-page-header p{
          font-size:10px;
          line-height:16px;
        }

        .rfai-header-actions{
          display:grid;
          grid-template-columns:1fr;
        }

        .rfai-session-pill{
          width:100%;
        }

        .rfai-chat-card{
          min-height:600px;
        }

        .rfai-messages{
          padding:13px;
        }

        .rfai-message{
          max-width:92%;
        }

        .rfai-composer footer{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfai-side{
          grid-template-columns:1fr;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-ai-v7,
        .rfai-thinking > i,
        .rfai-spin{
          animation:none!important;
        }

        .rf-ai-v7 *,
        .rf-ai-v7 *::before,
        .rf-ai-v7 *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
