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

const welcomeMessage = {
  role: "assistant",
  text:
    "Hi, I’m ReachFly AI. I can review your current ReachFly screen, explain what is happening, and suggest the best next action.",
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
    if (!open) {
      return;
    }

    if (
      lastAnalysedPath.current ===
      location.pathname
    ) {
      return;
    }

    lastAnalysedPath.current =
      location.pathname;

    analyseCurrentScreen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, location.pathname]);

  if (
    initializing ||
    !isAuthenticated
  ) {
    return null;
  }

  const send = async (
    requestedText = input
  ) => {
    const command = String(
      requestedText || ""
    ).trim();

    if (!command || loading) {
      return;
    }

    setInput("");

    setMessages((current) => [
      ...current,
      {
        role: "user",
        text: command,
      },
    ]);

    setLoading(true);

    try {
      const latestScreen =
        buildScreenContext({
          pathname:
            location.pathname,

          search:
            location.search,

          user,
        });

      const result =
        await sendContextualCommand(
          command,
          latestScreen
        );

      const reply =
        result?.reply ||
        result?.message ||
        "I reviewed this screen, but no recommendation was returned.";

      const nextMessage = {
        role: "assistant",
        text: reply,

        action:
          result?.action ||
          null,

        link:
          result?.link ||
          result?.url ||
          "",

        campaign:
          result?.campaign ||
          null,
      };

      setMessages((current) => [
        ...current,
        nextMessage,
      ]);

      if (!open) {
        setUnread(true);
      }
    } catch (error) {
      setMessages((current) => [
        ...current,
        {
          role: "assistant",
          text:
            error?.message ||
            "ReachFly AI could not process this request.",
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  async function analyseCurrentScreen() {
    if (loading) {
      return;
    }

    setLoading(true);

    try {
      const currentScreen =
        buildScreenContext({
          pathname:
            location.pathname,

          search:
            location.search,

          user,
        });

      const result =
        await sendContextualCommand(
          [
            "Review my current ReachFly screen.",
            "Briefly explain what I should check next.",
            "Give at most three practical actions.",
            "Only discuss ReachFly data and workflows.",
          ].join(" "),
          currentScreen
        );

      const reply =
        result?.reply ||
        result?.message;

      if (reply) {
        setMessages((current) => {
          const withoutPreviousAnalysis =
            current.filter(
              (message) =>
                message.type !==
                "screen-analysis"
            );

          return [
            ...withoutPreviousAnalysis,
            {
              role: "assistant",
              type: "screen-analysis",
              text: reply,

              action:
                result?.action ||
                null,

              link:
                result?.link ||
                result?.url ||
                "",

              campaign:
                result?.campaign ||
                null,
            },
          ];
        });
      }
    } catch (error) {
      console.error(
        "ReachFly screen analysis failed:",
        error
      );
    } finally {
      setLoading(false);
    }
  }

  const openBot = () => {
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
      {open ? (
        <section
          className="reachfly-ai-floating-panel"
          aria-label="ReachFly AI assistant"
        >
          <header className="reachfly-ai-floating-header">
            <div className="reachfly-ai-floating-heading">
              <span className="reachfly-ai-floating-avatar">
                RF
              </span>

              <div>
                <strong>
                  ReachFly AI
                </strong>

                <small>
                  Analysing{" "}
                  {screen.pageName}
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
                title="Analyse current screen"
              >
                ↻
              </button>

              <button
                type="button"
                onClick={closeBot}
                title="Close ReachFly AI"
                aria-label="Close ReachFly AI"
              >
                ×
              </button>
            </div>
          </header>

          <div className="reachfly-ai-screen-context">
            <span>
              Current screen
            </span>

            <b>{screen.pageName}</b>

            {screen.heading ? (
              <small>
                {screen.heading}
              </small>
            ) : null}
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
                  <p>
                    {message.text}
                  </p>

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
              ➤
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
        <span className="reachfly-ai-trigger-logo">
          RF
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

    visibleSummary:
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
    .slice(0, 12);

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

  return {
    heading,
    subheading,
    actions,

    summary:
      textNodes
        .join(" | ")
        .slice(0, 2500),
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