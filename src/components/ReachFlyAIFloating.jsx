import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import {
  useLocation,
  useNavigate,
} from "react-router-dom";
import { api } from "../api";
import { useAuth } from "../auth/AuthContext";
import {
  ChevronRight,
  RefreshCw,
  Send,
  Shield,
  Sparkles,
  X,
} from "./icons";

const AUTO_OPEN_IDLE_MS = 30_000;

const welcomeMessage = {
  role: "assistant",
  text:
    "Hi, I’m ReachFly AI. I can review your current ReachFly screen, explain what is happening, and suggest the best next action.",
};

const proactiveMessage = {
  role: "assistant",
  type: "proactive-nudge",
  text:
    "Still on this page? If you’re stuck, tell me what you’re trying to do and I’ll guide you from this screen.",
};

export default function ReachFlyAIFloating() {
  const location = useLocation();
  const navigate = useNavigate();

  const {
    user,
    isAuthenticated,
    initializing,
  } = useAuth();

  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] =
    useState(false);

  const [messages, setMessages] =
    useState([welcomeMessage]);

  const [unread, setUnread] =
    useState(false);

  const endRef = useRef(null);
  const lastAnalysedPath = useRef("");
  const inactivityTimerRef = useRef(null);
  const loadingRef = useRef(false);
  const streamIdRef = useRef(0);

  const screen = useMemo(
    () =>
      buildScreenContext({
        pathname: location.pathname,
        search: location.search,
        user,
      }),
    [
      location.pathname,
      location.search,
      user,
    ]
  );

  const localSuggestions = useMemo(
    () =>
      getLocalSuggestions(
        location.pathname
      ),
    [location.pathname]
  );

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    if (!open) {
      return;
    }

    window.setTimeout(() => {
      endRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    }, 30);
  }, [messages, loading, open]);

  useEffect(() => {
    if (!isAuthenticated || initializing || typeof window === "undefined") {
      return undefined;
    }

    const routeKey = `${location.pathname}${location.search || ""}`;
    const sessionKey = `reachfly-ai-nudged:${routeKey}`;
    let lastActivityAt = Date.now();

    const clearTimer = () => {
      if (inactivityTimerRef.current) {
        window.clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };

    const schedule = () => {
      clearTimer();
      if (window.sessionStorage.getItem(sessionKey) === "1") return;

      inactivityTimerRef.current = window.setTimeout(() => {
        if (document.hidden || open || loadingRef.current) {
          schedule();
          return;
        }

        const idleFor = Date.now() - lastActivityAt;
        if (idleFor < AUTO_OPEN_IDLE_MS - 250) {
          schedule();
          return;
        }

        window.sessionStorage.setItem(sessionKey, "1");
        setOpen(true);
        setUnread(false);
        setMessages((current) => {
          const withoutOldNudge = current.filter(
            (message) => message.type !== "proactive-nudge"
          );

          const hasConversation = withoutOldNudge.some(
            (message) => message.role === "user"
          );

          if (!hasConversation && withoutOldNudge.length <= 1) {
            return [proactiveMessage];
          }

          return [...withoutOldNudge, proactiveMessage];
        });
      }, AUTO_OPEN_IDLE_MS);
    };

    const markActivity = () => {
      lastActivityAt = Date.now();
      schedule();
    };

    ["pointerdown", "keydown", "touchstart"].forEach((eventName) =>
      window.addEventListener(eventName, markActivity, { passive: true })
    );
    window.addEventListener("scroll", markActivity, { passive: true });
    schedule();

    return () => {
      clearTimer();
      ["pointerdown", "keydown", "touchstart"].forEach((eventName) =>
        window.removeEventListener(eventName, markActivity)
      );
      window.removeEventListener("scroll", markActivity);
    };
  }, [
    initializing,
    isAuthenticated,
    location.pathname,
    location.search,
    open,
  ]);

  if (
    initializing ||
    !isAuthenticated
  ) {
    return null;
  }

  const streamAssistantReply = async ({
    command,
    latestScreen,
    type = "",
    automatic = false,
    replaceType = "",
  }) => {
    const streamId = `rfai-${Date.now()}-${streamIdRef.current++}`;

    setMessages((current) => {
      const base = replaceType
        ? current.filter((message) => message.type !== replaceType)
        : current;

      return [
        ...base,
        {
          id: streamId,
          role: "assistant",
          type,
          text: "",
          streaming: true,
        },
      ];
    });

    const appendDelta = (delta) => {
      if (!delta) return;
      setMessages((current) =>
        current.map((message) =>
          message.id === streamId
            ? {
                ...message,
                text: `${message.text || ""}${delta}`,
              }
            : message
        )
      );
    };

    const result = typeof api.contextualCommandStream === "function"
      ? await api.contextualCommandStream(command, latestScreen, {
          automatic,
          onDelta: appendDelta,
        })
      : await api.contextualCommand(command, latestScreen, { automatic });

    const finalReply = safeAiMessage(
      result?.reply || result?.message || "I reviewed this screen."
    );

    setMessages((current) =>
      current.map((message) =>
        message.id === streamId
          ? {
              ...message,
              text: message.text?.trim() ? safeAiMessage(message.text) : finalReply,
              streaming: false,
              action: result?.action || null,
              link: result?.link || result?.url || "",
              campaign: result?.campaign || null,
              support: result?.support || null,
            }
          : message
      )
    );

    return result;
  };

  const send = async (requestedText = input) => {
    const command = String(requestedText || "").trim();
    if (!command || loadingRef.current) return;

    setInput("");
    setMessages((current) => [
      ...current,
      { role: "user", text: command },
    ]);
    setLoading(true);
    loadingRef.current = true;

    try {
      const latestScreen = buildScreenContext({
        pathname: location.pathname,
        search: location.search,
        user,
      });

      await streamAssistantReply({
        command,
        latestScreen,
        automatic: false,
      });

      if (!open) setUnread(true);
    } catch (error) {
      setMessages((current) => [
        ...current.filter((message) => !message.streaming),
        {
          role: "assistant",
          text: safeAiMessage(
            error?.message || "ReachFly AI could not process this request."
          ),
          error: true,
        },
      ]);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  };

  async function analyseCurrentScreen({ automatic = true, proactive = false } = {}) {
    if (loadingRef.current) return;

    const routeKey = `${location.pathname}${location.search || ""}`;
    lastAnalysedPath.current = routeKey;
    setLoading(true);
    loadingRef.current = true;

    try {
      const currentScreen = buildScreenContext({
        pathname: location.pathname,
        search: location.search,
        user,
      });

      const prompt = proactive
        ? [
            "The user has been inactive on this ReachFly screen for about 30 seconds and may be stuck.",
            "Look at the current page context and proactively help them continue.",
            "Start with one short question or observation, then give up to three exact next steps.",
            "If there is a visible error, explain it using only the supplied context.",
          ].join(" ")
        : [
            "Review my current ReachFly screen.",
            "Explain what this page is for and what I should check next.",
            "Give at most three practical actions using the controls that are actually visible.",
          ].join(" ");

      await streamAssistantReply({
        command: prompt,
        latestScreen: currentScreen,
        type: "screen-analysis",
        replaceType: "screen-analysis",
        automatic,
      });
    } catch (error) {
      console.error("ReachFly screen analysis failed:", error);
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }

  const openBot = () => {
    try {
      window.sessionStorage.setItem(
        `reachfly-ai-nudged:${location.pathname}${location.search || ""}`,
        "1"
      );
    } catch {}
    setOpen(true);
    setUnread(false);
  };

  const closeBot = () => {
    setOpen(false);
  };

  const handleAction = (
    message
  ) => {
    const target =
      message?.link ||
      (
        message?.campaign?.id
          ? `/app/campaigns/${message.campaign.id}`
          : ""
      );

    if (!target) {
      return;
    }

    if (
      target.startsWith("http://") ||
      target.startsWith("https://")
    ) {
      window.open(
        target,
        "_blank",
        "noopener,noreferrer"
      );

      return;
    }

    navigate(target);
    closeBot();
  };

  return createPortal(
    <>
      <ReachFlyAIFloatingStyles />

      {open ? (
        <section
          className="reachfly-ai-floating-panel"
          aria-label="ReachFly AI assistant"
        >
          <header className="reachfly-ai-floating-header">
            <div className="reachfly-ai-floating-heading">
              <span className="reachfly-ai-floating-avatar" aria-hidden="true">
                <span>RF</span>
                <i />
              </span>

              <div>
                <strong>
                  ReachFly AI
                </strong>

                <small>
                  Live Claude assistant
                </small>
              </div>
            </div>

            <div className="reachfly-ai-floating-header-actions">
              <button
                type="button"
                onClick={
                  analyseCurrentScreen
                }
                disabled={loading}
                title="Review current screen"
                aria-label="Review current screen"
              >
                <RefreshCw
                  size={14}
                  className={
                    loading
                      ? "rfai-floating-spin"
                      : ""
                  }
                />
              </button>

              <button
                type="button"
                onClick={closeBot}
                title="Close ReachFly AI"
                aria-label="Close ReachFly AI"
              >
                <X size={14} />
              </button>
            </div>
          </header>

          <div className="reachfly-ai-screen-context">
            <span>
              <Sparkles size={12} />
              Current screen
            </span>

            <b>{screen.pageName}</b>

            {screen.heading ? (
              <small>
                {screen.heading}
              </small>
            ) : null}

            <em>
              <Shield size={11} />
              Current page + workspace context
            </em>
          </div>

          <div className="reachfly-ai-floating-messages">
            {messages.map(
              (message, index) => (
                <article
                  key={`${message.role}-${index}`}
                  className={`reachfly-ai-floating-message ${message.role} ${
                    message.error
                      ? "error"
                      : ""
                  }`}
                >
                  <span className="reachfly-ai-message-role">
                    {message.role === "user" ? "You" : "ReachFly AI"}
                  </span>

                  <p>
                    {safeAiMessage(message.text)}
                  </p>

                  {message.support?.id ? (
                    <span className="reachfly-ai-support-chip">
                      Support request {message.support.emailStatus === "sent" ? "sent" : "queued"}
                    </span>
                  ) : null}

                  {message.link ||
                  message.campaign?.id ? (
                    <button
                      type="button"
                      className="reachfly-ai-message-action"
                      onClick={() =>
                        handleAction(
                          message
                        )
                      }
                    >
                      Open recommended screen
                      <ChevronRight size={12} />
                    </button>
                  ) : null}
                </article>
              )
            )}

            {loading ? (
              <article className="reachfly-ai-floating-message assistant loading">
                <span />
                <span />
                <span />
              </article>
            ) : null}

            <div ref={endRef} />
          </div>

          <div className="reachfly-ai-quick-actions">
            {localSuggestions.map(
              (suggestion) => (
                <button
                  key={suggestion}
                  type="button"
                  disabled={loading}
                  onClick={() =>
                    send(suggestion)
                  }
                >
                  {suggestion}
                </button>
              )
            )}
          </div>

          <form
            className="reachfly-ai-floating-form"
            onSubmit={(event) => {
              event.preventDefault();
              send();
            }}
          >
            <textarea
              rows={1}
              value={input}
              onChange={(event) =>
                setInput(
                  event.target.value
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key ===
                    "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();
                  send();
                }
              }}
              placeholder="Ask about this screen…"
            />

            <button
              type="submit"
              disabled={
                loading ||
                !input.trim()
              }
              aria-label="Send message"
            >
              <Send size={15} />
            </button>
          </form>
        </section>
      ) : null}

      <button
        type="button"
        className={`reachfly-ai-floating-trigger ${
          open ? "open" : ""
        }`}
        onClick={
          open ? closeBot : openBot
        }
        aria-label={
          open
            ? "Close ReachFly AI"
            : "Open ReachFly AI"
        }
      >
        <span className="reachfly-ai-trigger-logo" aria-hidden="true">
          <span>RF</span>
          <i />
        </span>

        <span className="reachfly-ai-trigger-label">
          ReachFly AI
        </span>

        {unread ? (
          <i className="reachfly-ai-unread" />
        ) : null}
      </button>
    </>,
    document.body
  );
}

async function sendContextualCommand(
  command,
  screen
) {
  if (
    typeof api.contextualCommand ===
    "function"
  ) {
    return api.contextualCommand(
      command,
      screen
    );
  }

  return api.reachflyCommand(
    command,
    screen
  );
}

function buildScreenContext({
  pathname,
  search,
  user,
}) {
  const pageInformation =
    readVisiblePageInformation();

  const identifiers =
    getRouteIdentifiers(
      pathname
    );

  return {
    pathname,
    search,

    pageName:
      getPageName(pathname),

    title:
      document.title || "",

    heading:
      pageInformation.heading,

    subheading:
      pageInformation.subheading,

    visibleActions:
      pageInformation.actions,

    headings:
      pageInformation.headings,

    visibleText:
      pageInformation.summary,

    campaignId:
      identifiers.campaignId,

    leadId:
      identifiers.leadId,

    accountId:
      identifiers.accountId,

    user: {
      id: user?.id || "",
      name: user?.name || "",
      email: user?.email || "",

      role:
        user?.workspaceRole ||
        user?.role ||
        "",

      accountType:
        user?.accountType ||
        "",
    },
  };
}

function readVisiblePageInformation() {
  if (
    typeof document ===
    "undefined"
  ) {
    return {
      heading: "",
      subheading: "",
      actions: [],
      headings: [],
      summary: "",
    };
  }

  const main =
    document.querySelector(
      "main, [role='main'], .app-main, .dashboard-main, .page"
    ) ||
    document.body;

  const heading =
    main
      .querySelector("h1")
      ?.textContent?.trim() ||
    "";

  const subheading =
    main
      .querySelector(
        ".page-heading p, h1 + p"
      )
      ?.textContent?.trim() ||
    "";

  const actions = Array.from(
    main.querySelectorAll(
      "button, a"
    )
  )
    .filter(
      (element) =>
        element.offsetParent !==
        null
    )
    .map((element) =>
      element.textContent
        ?.replace(/\s+/g, " ")
        .trim()
    )
    .filter(Boolean)
    .slice(0, 40);

  const textNodes =
    Array.from(
      main.querySelectorAll(
        "h1, h2, h3, p, th, td, small, .badge, .status"
      )
    )
      .filter(
        (element) =>
          element.offsetParent !==
          null
      )
      .map((element) =>
        element.textContent
          ?.replace(/\s+/g, " ")
          .trim()
      )
      .filter(Boolean);

  const headings = Array.from(
    main.querySelectorAll("h1, h2, h3")
  )
    .filter((element) => element.offsetParent !== null)
    .map((element) => element.textContent?.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 30);

  return {
    heading,
    subheading,
    actions,
    headings,

    summary:
      textNodes
        .join(" | ")
        .slice(0, 8000),
  };
}

function getRouteIdentifiers(
  pathname
) {
  const parts = String(
    pathname || ""
  )
    .split("/")
    .filter(Boolean);

  const campaignIndex =
    parts.indexOf("campaigns");

  const leadIndex =
    parts.indexOf("leads");

  const accountIndex =
    parts.indexOf("accounts");

  return {
    campaignId:
      campaignIndex >= 0
        ? parts[
            campaignIndex + 1
          ] || ""
        : "",

    leadId:
      leadIndex >= 0
        ? parts[
            leadIndex + 1
          ] || ""
        : "",

    accountId:
      accountIndex >= 0
        ? parts[
            accountIndex + 1
          ] || ""
        : "",
  };
}

function getPageName(pathname) {
  const path = String(
    pathname || ""
  ).toLowerCase();

  if (
    path.includes(
      "/campaigns/"
    ) &&
    path.includes("/pipeline")
  ) {
    return "Pipeline Builder";
  }

  if (
    path.includes(
      "/campaigns/"
    )
  ) {
    return "Campaign Details";
  }

  if (
    path.includes(
      "/campaigns"
    )
  ) {
    return "Campaigns";
  }

  if (
    path.includes("/my-leads")
  ) {
    return "My Leads";
  }

  if (
    path.includes("/team")
  ) {
    return "Team Management";
  }

  if (
    path.includes(
      "/performance"
    )
  ) {
    return "Team Performance";
  }

  if (
    path.includes("/audits")
  ) {
    return "Website Audits";
  }

  if (
    path.includes("/contacts")
  ) {
    return "Contacts";
  }

  if (
    path.includes("/inbox")
  ) {
    return "Inbox";
  }

  if (
    path.includes("/email")
  ) {
    return "Email Setup";
  }

  if (
    path.includes("/whatsapp")
  ) {
    return "WhatsApp Setup";
  }

  if (
    path.includes("/territories")
  ) {
    return "Territories";
  }

  if (
    path.includes("/analytics")
  ) {
    return "Analytics";
  }

  if (
    path.includes("/settings")
  ) {
    return "Settings";
  }

  if (
    path.includes("/builder")
  ) {
    return "Campaign Builder";
  }

  if (path.includes("/connections") || path.includes("/integrations")) {
    return "Integrations";
  }

  if (path.includes("/voice-agent")) {
    return "AI Voice";
  }

  if (path.includes("/agents")) {
    return "Voice Agents";
  }

  if (path.includes("/billing")) {
    return "Billing";
  }

  if (path.includes("/pipeline")) {
    return "Pipeline";
  }

  if (path.includes("/leads")) {
    const params = new URLSearchParams(window.location.search || "");
    if (params.get("view") === "all") return "All Leads";
    if (params.get("view") === "external") return "External Leads";
    return "Find Leads";
  }

  if (
    path.includes("/dashboard")
  ) {
    return "Dashboard";
  }

  return "ReachFly Workspace";
}

function getLocalSuggestions(
  pathname
) {
  const path = String(
    pathname || ""
  ).toLowerCase();

  if (
    path.includes("/builder")
  ) {
    return [
      "Check my campaign setup",
      "What should I select next?",
      "Review my lead targeting",
    ];
  }

  if (
    path.includes(
      "/campaigns/"
    ) &&
    path.includes("/pipeline")
  ) {
    return [
      "Review this sequence",
      "Improve my follow-ups",
      "Is this campaign ready?",
    ];
  }

  if (
    path.includes(
      "/campaigns/"
    )
  ) {
    return [
      "Summarise this campaign",
      "What needs attention?",
      "Suggest the next action",
    ];
  }

  if (
    path.includes("/my-leads")
  ) {
    return [
      "Which lead should I call?",
      "Find overdue follow-ups",
      "Suggest today's priorities",
    ];
  }

  if (
    path.includes("/team")
  ) {
    return [
      "Review team workload",
      "Suggest lead assignments",
      "Find performance issues",
    ];
  }

  if (
    path.includes("/email")
  ) {
    return [
      "Check email readiness",
      "Explain sender setup",
      "What should I configure?",
    ];
  }

  if (
    path.includes("/audits")
  ) {
    return [
      "Summarise audit findings",
      "Find strongest opportunity",
      "Draft a call opener",
    ];
  }

  if (
    path.includes("/analytics")
  ) {
    return [
      "Explain these metrics",
      "Find the weakest stage",
      "Suggest improvements",
    ];
  }

  return [
    "Review this screen",
    "What should I do next?",
    "Show my priorities",
  ];
}

function safeAiMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/\bWebRTC\b/gi, "browser calling");
}

// Replace ONLY the ReachFlyAIFloatingStyles() function
// in web/src/components/ReachFlyAIFloating.jsx with this version.

function ReachFlyAIFloatingStyles() {
  return (
    <style>{`
      :root{
        --rfaf-text:#191c1d;
        --rfaf-text2:#4d4c59;
        --rfaf-muted:#777784;
        --rfaf-line:#e2e4e7;
        --rfaf-primary:#4648d4;
        --rfaf-primary-dark:#393bbb;
        --rfaf-red:#ba1a1a;
        --rfaf-red-soft:#ffedeb;
        --rfaf-dark:#2e3132;
        --rfaf-ease:cubic-bezier(.2,.8,.2,1);
      }

      @keyframes rfafPanelIn{
        from{
          opacity:0;
          transform:translateY(12px) scale(.985);
        }
        to{
          opacity:1;
          transform:none;
        }
      }

      @keyframes rfafTriggerIn{
        from{
          opacity:0;
          transform:translateY(7px);
        }
        to{
          opacity:1;
          transform:none;
        }
      }

      @keyframes rfafThinking{
        0%,80%,100%{
          transform:translateY(0);
          opacity:.35;
        }
        40%{
          transform:translateY(-3px);
          opacity:1;
        }
      }

      @keyframes rfafUnread{
        0%,100%{
          box-shadow:0 0 0 0 rgba(70,72,212,.3);
        }
        50%{
          box-shadow:0 0 0 5px rgba(70,72,212,0);
        }
      }

      @keyframes rfafSpin{
        to{
          transform:rotate(360deg);
        }
      }

      .rfai-floating-spin{
        animation:rfafSpin .75s linear infinite;
      }

      .reachfly-ai-floating-panel,
      .reachfly-ai-floating-trigger{
        box-sizing:border-box;
        font-family:
          Inter,
          system-ui,
          -apple-system,
          BlinkMacSystemFont,
          "Segoe UI",
          sans-serif;
      }

      .reachfly-ai-floating-panel *,
      .reachfly-ai-floating-panel *::before,
      .reachfly-ai-floating-panel *::after,
      .reachfly-ai-floating-trigger *,
      .reachfly-ai-floating-trigger *::before,
      .reachfly-ai-floating-trigger *::after{
        box-sizing:border-box;
      }

      /*
       * MAIN ASSISTANT PANEL
       *
       * IMPORTANT:
       * The assistant is attached to the RIGHT side.
       * It never uses the left sidebar position.
       */
      .reachfly-ai-floating-panel{
        position:fixed !important;

        top:auto !important;
        left:auto !important;

        right:22px !important;
        bottom:82px !important;

        width:380px !important;
        min-width:0 !important;
        max-width:calc(100vw - 44px) !important;

        height:min(590px,calc(100vh - 110px)) !important;
        min-height:0 !important;
        max-height:calc(100vh - 110px) !important;

        margin:0 !important;

        z-index:2147483000;

        display:grid;
        grid-template-rows:
          auto
          auto
          minmax(0,1fr)
          auto
          auto;

        overflow:hidden;

        color:var(--rfaf-text);
        background:#fff;

        border:1px solid rgba(226,228,231,.98);
        border-radius:18px;

        box-shadow:
          0 28px 80px rgba(25,28,29,.18),
          0 8px 24px rgba(70,72,212,.08);

        animation:rfafPanelIn .22s var(--rfaf-ease);

        transform-origin:bottom right;
      }

      .reachfly-ai-floating-header{
        min-height:70px;

        display:flex;
        align-items:center;
        justify-content:space-between;

        gap:10px;

        padding:12px 13px;

        color:#fff;

        background:
          radial-gradient(
            circle at 87% 12%,
            rgba(95,98,231,.25),
            transparent 34%
          ),
          #2e3132;

        border-bottom:1px solid rgba(255,255,255,.06);
      }

      .reachfly-ai-floating-heading{
        min-width:0;

        display:grid;
        grid-template-columns:39px minmax(0,1fr);

        align-items:center;
        gap:9px;
      }

      .reachfly-ai-floating-avatar{
        width:40px;
        height:40px;

        position:relative;

        display:grid;
        place-items:center;

        overflow:hidden;

        color:#fff;

        background:
          radial-gradient(
            circle at 72% 22%,
            rgba(255,255,255,.34),
            transparent 22%
          ),
          linear-gradient(
            145deg,
            #6d5dfc,
            #4f46e5 56%,
            #312e81
          );

        border:1px solid rgba(255,255,255,.2);
        border-radius:13px;

        box-shadow:
          0 9px 22px rgba(31,41,55,.22);
      }

      .reachfly-ai-floating-avatar > span{
        font-size:12px;
        line-height:1;
        font-weight:900;
        letter-spacing:-.05em;
      }

      .reachfly-ai-floating-avatar > i{
        position:absolute;

        width:7px;
        height:7px;

        right:5px;
        bottom:5px;

        border-radius:50%;

        background:#6ee7b7;

        border:2px solid #4143c5;

        box-shadow:
          0 0 0 2px rgba(110,231,183,.12);
      }

      .reachfly-ai-floating-heading > div{
        min-width:0;
        display:grid;
      }

      .reachfly-ai-floating-heading strong{
        color:#fff;

        font:
          600
          13px/18px
          Geist,
          Inter,
          sans-serif;
      }

      .reachfly-ai-floating-heading small{
        margin-top:1px;

        color:rgba(244,246,247,.58);

        font-size:9px;
      }

      .reachfly-ai-floating-header-actions{
        display:flex;
        align-items:center;
        gap:5px;
      }

      .reachfly-ai-floating-header-actions button{
        width:31px;
        height:31px;

        display:grid;
        place-items:center;

        padding:0;

        color:rgba(255,255,255,.82);

        background:rgba(255,255,255,.07);

        border:1px solid rgba(255,255,255,.08);
        border-radius:8px;

        cursor:pointer;

        transition:.14s var(--rfaf-ease);
      }

      .reachfly-ai-floating-header-actions button:hover:not(:disabled){
        color:#fff;
        background:rgba(255,255,255,.13);
      }

      .reachfly-ai-floating-header-actions button:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .reachfly-ai-screen-context{
        display:grid;

        grid-template-columns:
          minmax(0,1fr)
          auto;

        align-items:center;

        gap:3px 8px;

        padding:9px 12px;

        background:
          linear-gradient(
            135deg,
            #f8f8ff,
            #fff
          );

        border-bottom:
          1px solid
          var(--rfaf-line);
      }

      .reachfly-ai-screen-context > span{
        display:flex;
        align-items:center;
        gap:5px;

        color:var(--rfaf-primary);

        font-size:7px;
        font-weight:800;

        letter-spacing:.05em;

        text-transform:uppercase;
      }

      .reachfly-ai-screen-context > b{
        grid-column:1;

        overflow:hidden;

        color:var(--rfaf-text);

        text-overflow:ellipsis;
        white-space:nowrap;

        font-size:9px;
      }

      .reachfly-ai-screen-context > small{
        grid-column:1;

        overflow:hidden;

        color:var(--rfaf-muted);

        text-overflow:ellipsis;
        white-space:nowrap;

        font-size:7px;
      }

      .reachfly-ai-screen-context > em{
        grid-column:2;
        grid-row:1 / span 3;

        display:flex;
        align-items:center;

        gap:4px;

        max-width:120px;

        padding:5px 6px;

        color:#5e5f84;

        background:#fff;

        border:1px solid #e3e3f4;
        border-radius:7px;

        font-size:6px;
        font-style:normal;
        line-height:9px;
      }

      .reachfly-ai-floating-messages{
        min-height:0;

        overflow-y:auto;
        overscroll-behavior:contain;

        display:grid;
        align-content:start;

        gap:9px;

        padding:13px;

        background:
          radial-gradient(
            circle at 95% 5%,
            rgba(70,72,212,.035),
            transparent 24%
          ),
          #fff;

        scrollbar-width:thin;
        scrollbar-color:#d8d9dd transparent;
      }

      .reachfly-ai-floating-message{
        max-width:87%;

        display:grid;

        gap:4px;

        padding:9px 10px;

        color:var(--rfaf-text2);

        background:#f4f5f6;

        border:1px solid #eceeef;
        border-radius:10px 10px 10px 4px;
      }

      .reachfly-ai-floating-message.user{
        justify-self:end;

        color:#fff;

        background:var(--rfaf-primary);

        border-color:var(--rfaf-primary);
        border-radius:10px 10px 4px 10px;

        box-shadow:
          0 5px 13px rgba(70,72,212,.1);
      }

      .reachfly-ai-floating-message.error{
        color:#7c1d1d;

        background:var(--rfaf-red-soft);

        border-color:#ffd0cc;
      }

      .reachfly-ai-message-role{
        color:var(--rfaf-muted);

        font-size:7px;
        font-weight:800;

        letter-spacing:.045em;

        text-transform:uppercase;
      }

      .reachfly-ai-floating-message.user
      .reachfly-ai-message-role{
        color:rgba(255,255,255,.63);
      }

      .reachfly-ai-floating-message p{
        margin:0;

        white-space:pre-wrap;
        overflow-wrap:anywhere;

        font-size:12px;
        line-height:1.48;
      }

      .reachfly-ai-floating-message.user p{
        color:#fff;
      }

      .reachfly-ai-message-action{
        width:max-content;
        max-width:100%;

        min-height:29px;

        display:inline-flex;

        align-items:center;
        justify-content:center;

        gap:4px;

        margin-top:3px;

        padding:5px 7px;

        color:var(--rfaf-primary);

        background:#fff;

        border:1px solid #dcdcff;
        border-radius:7px;

        cursor:pointer;

        font-size:7px;
        font-weight:750;

        transition:.13s var(--rfaf-ease);
      }

      .reachfly-ai-message-action:hover{
        transform:translateY(-1px);

        background:#fafaff;
      }

      .reachfly-ai-support-chip{
        display:inline-flex;

        width:max-content;
        max-width:100%;

        margin-top:8px;

        padding:5px 8px;

        border-radius:999px;

        background:#eefaf5;

        border:1px solid #ccefdc;

        color:#087f50;

        font-size:10px;
        line-height:14px;
        font-weight:800;
      }

      .reachfly-ai-floating-message.loading{
        width:74px;

        grid-template-columns:
          repeat(3,6px);

        align-items:center;

        gap:4px;
      }

      .reachfly-ai-floating-message.loading > span{
        width:6px;
        height:6px;

        background:var(--rfaf-primary);

        border-radius:50%;

        animation:
          rfafThinking
          1s
          infinite
          ease-in-out;
      }

      .reachfly-ai-floating-message.loading > span:nth-child(2){
        animation-delay:.12s;
      }

      .reachfly-ai-floating-message.loading > span:nth-child(3){
        animation-delay:.24s;
      }

      .reachfly-ai-quick-actions{
        display:flex;

        gap:5px;

        overflow-x:auto;

        padding:8px 10px;

        background:#fafbfb;

        border-top:1px solid var(--rfaf-line);

        scrollbar-width:none;
      }

      .reachfly-ai-quick-actions::-webkit-scrollbar{
        display:none;
      }

      .reachfly-ai-quick-actions button{
        min-height:29px;

        flex:0 0 auto;

        padding:5px 8px;

        color:#55567d;

        background:#fff;

        border:1px solid #e0e1ef;
        border-radius:999px;

        cursor:pointer;

        font-size:7px;
        font-weight:700;

        white-space:nowrap;

        transition:.13s var(--rfaf-ease);
      }

      .reachfly-ai-quick-actions button:hover:not(:disabled){
        color:var(--rfaf-primary);

        border-color:#cbccfb;

        background:#f8f8ff;
      }

      .reachfly-ai-quick-actions button:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .reachfly-ai-floating-form{
        min-height:66px;

        display:grid;

        grid-template-columns:
          minmax(0,1fr)
          38px;

        align-items:center;

        gap:7px;

        padding:9px 10px 10px;

        background:#fff;

        border-top:1px solid var(--rfaf-line);
      }

      .reachfly-ai-floating-form textarea{
        width:100%;

        min-height:40px;
        max-height:96px;

        resize:none;

        padding:11px 10px;

        color:var(--rfaf-text);

        background:#f6f7f8;

        border:1px solid transparent;
        border-radius:9px;

        outline:0;

        font:
          400
          12px/17px
          Inter,
          sans-serif;
      }

      .reachfly-ai-floating-form textarea:focus{
        background:#fff;

        border-color:
          rgba(70,72,212,.5);

        box-shadow:
          0 0 0 3px
          rgba(70,72,212,.06);
      }

      .reachfly-ai-floating-form button{
        width:38px;
        height:38px;

        display:grid;
        place-items:center;

        padding:0;

        color:#fff;

        background:var(--rfaf-primary);

        border:0;
        border-radius:9px;

        cursor:pointer;

        box-shadow:
          0 6px 13px
          rgba(70,72,212,.15);
      }

      .reachfly-ai-floating-form button:hover:not(:disabled){
        background:var(--rfaf-primary-dark);
      }

      .reachfly-ai-floating-form button:disabled{
        opacity:.38;
        cursor:not-allowed;
      }

      /*
       * FLOATING BUTTON
       *
       * RIGHT SIDE.
       */
      .reachfly-ai-floating-trigger{
        position:fixed !important;

        top:auto !important;
        left:auto !important;

        right:22px !important;
        bottom:22px !important;

        width:auto !important;
        min-width:0 !important;
        max-width:180px !important;

        min-height:48px;

        z-index:2147483001;

        display:flex;

        align-items:center;

        gap:8px;

        padding:6px 11px 6px 6px;

        color:#fff;

        background:
          linear-gradient(
            135deg,
            #3c3e40,
            #2e3132
          );

        border:
          1px solid
          rgba(255,255,255,.08);

        border-radius:999px;

        box-shadow:
          0 11px 28px rgba(25,28,29,.18),
          0 3px 10px rgba(70,72,212,.12);

        cursor:pointer;

        animation:
          rfafTriggerIn
          .22s
          var(--rfaf-ease);

        transition:
          .15s
          var(--rfaf-ease);
      }

      .reachfly-ai-floating-trigger:hover{
        transform:translateY(-2px);

        box-shadow:
          0 15px 34px rgba(25,28,29,.2),
          0 5px 13px rgba(70,72,212,.15);
      }

      .reachfly-ai-floating-trigger.open{
        background:var(--rfaf-primary);
      }

      .reachfly-ai-trigger-logo{
        width:36px;
        height:36px;

        position:relative;

        display:grid;
        place-items:center;

        overflow:hidden;

        color:#fff;

        background:
          radial-gradient(
            circle at 72% 22%,
            rgba(255,255,255,.32),
            transparent 22%
          ),
          linear-gradient(
            145deg,
            #6d5dfc,
            #4f46e5 58%,
            #312e81
          );

        border:
          1px solid
          rgba(255,255,255,.18);

        border-radius:12px;

        box-shadow:
          0 5px 14px
          rgba(0,0,0,.18);
      }

      .reachfly-ai-trigger-logo > span{
        font-size:11px;
        font-weight:900;
        letter-spacing:-.05em;
      }

      .reachfly-ai-trigger-logo > i{
        position:absolute;

        width:7px;
        height:7px;

        right:4px;
        bottom:4px;

        border-radius:50%;

        background:#6ee7b7;

        border:2px solid #4143c5;
      }

      .reachfly-ai-floating-trigger.open
      .reachfly-ai-trigger-logo{
        background:
          rgba(255,255,255,.13);
      }

      .reachfly-ai-trigger-label{
        padding-right:2px;

        font-size:10px;
        font-weight:750;

        letter-spacing:-.01em;

        white-space:nowrap;
      }

      .reachfly-ai-unread{
        position:absolute;

        top:2px;
        right:4px;

        width:8px;
        height:8px;

        background:#7b7df1;

        border:2px solid #fff;
        border-radius:50%;

        animation:
          rfafUnread
          1.25s
          infinite
          ease-in-out;
      }

      /*
       * TABLET
       */
      @media(max-width:900px){
        .reachfly-ai-floating-panel{
          right:14px !important;
          bottom:76px !important;

          width:360px !important;

          max-width:
            calc(100vw - 28px) !important;

          height:
            min(
              560px,
              calc(100vh - 98px)
            ) !important;

          max-height:
            calc(100vh - 98px) !important;
        }

        .reachfly-ai-floating-trigger{
          right:14px !important;
          bottom:14px !important;
        }
      }

      /*
       * MOBILE
       *
       * Still right aligned.
       * It does NOT become a full-screen drawer.
       */
      @media(max-width:620px){
        .reachfly-ai-floating-panel{
          top:auto !important;
          left:auto !important;

          right:10px !important;
          bottom:72px !important;

          width:
            min(
              360px,
              calc(100vw - 20px)
            ) !important;

          max-width:
            calc(100vw - 20px) !important;

          height:
            min(
              540px,
              calc(100vh - 92px)
            ) !important;

          max-height:
            calc(100vh - 92px) !important;

          border-radius:14px !important;
        }

        .reachfly-ai-floating-trigger{
          top:auto !important;
          left:auto !important;

          right:10px !important;
          bottom:10px !important;
        }

        .reachfly-ai-screen-context > em{
          display:none;
        }

        .reachfly-ai-screen-context{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:410px){
        .reachfly-ai-floating-panel{
          right:8px !important;

          width:
            calc(100vw - 16px) !important;

          max-width:
            calc(100vw - 16px) !important;
        }

        .reachfly-ai-floating-trigger{
          right:8px !important;
        }

        .reachfly-ai-trigger-label{
          display:none;
        }

        .reachfly-ai-floating-trigger{
          width:48px !important;
          height:48px;

          padding:6px;

          justify-content:center;
        }

        .reachfly-ai-screen-context{
          padding:8px 10px;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .reachfly-ai-floating-panel,
        .reachfly-ai-floating-trigger,
        .reachfly-ai-floating-message.loading > span,
        .reachfly-ai-unread,
        .rfai-floating-spin{
          animation:none !important;
        }

        .reachfly-ai-floating-panel *,
        .reachfly-ai-floating-trigger *{
          transition-duration:.01ms !important;
          scroll-behavior:auto !important;
        }
      }
    `}</style>
  );
}
