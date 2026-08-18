import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useLocation,
  useParams,
} from "react-router-dom";

import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Globe2,
  Inbox as InboxIcon,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  RefreshCw,
  Send,
  Sparkles,
  UserRound,
  X,
} from "../components/icons";

import {
  api,
} from "../api";

/**
 * ReachFly.AI V7 Inbox Message Detail
 *
 * Existing behavior preserved and hardened:
 * - /app/inbox/:messageId remains the route.
 * - location.state.message is used immediately when provided.
 * - api.inboxMessage(messageId) is now the primary detail source.
 * - api.inbox() remains a compatibility fallback and supplies related messages.
 * - api.markInboxMessageRead(messageId) is preserved as a real mutation.
 * - Structured email text parsing/linkification is preserved.
 *
 * The visual layout is aligned with the migrated Stitch Inbox:
 * - compact Back to Inbox navigation
 * - message/contact header
 * - AI/context insight only when supported by real data
 * - full structured email content
 * - campaign/contact sidebar
 * - related thread activity from real synced inbox records
 *
 * ReachFly currently exposes inbox read/sync APIs but not a direct reply-send
 * endpoint here. Reply therefore opens the user's email client with mailto:
 * rather than pretending the reply was persisted in ReachFly.
 */

export default function InboxDetail() {
  const {
    messageId,
  } = useParams();

  const location =
    useLocation();

  const decodedId =
    useMemo(() => {
      try {
        return decodeURIComponent(
          messageId ||
            ""
        );
      } catch {
        return (
          messageId ||
          ""
        );
      }
    }, [
      messageId,
    ]);

  const initialMessage =
    unwrapMessage(
      location.state
        ?.message
    );

  const [
    message,
    setMessage,
  ] = useState(
    initialMessage
  );

  const [
    inboxItems,
    setInboxItems,
  ] = useState([]);

  const [
    loading,
    setLoading,
  ] = useState(
    !initialMessage
  );

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    markingRead,
    setMarkingRead,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const load =
    useCallback(
      async ({
        silent = false,
        successToast = false,
      } = {}) => {
        if (!decodedId) {
          setError(
            "This inbox message is missing an identifier."
          );
          setLoading(false);
          return;
        }

        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        let detailError =
          null;

        let inboxError =
          null;

        let detail =
          null;

        let list =
          [];

        try {
          const result =
            await api.inboxMessage(
              decodedId
            );

          detail =
            unwrapMessage(
              result
            );
        } catch (requestError) {
          detailError =
            requestError;
        }

        try {
          const result =
            await api.inbox();

          list =
            normalizeInboxResponse(
              result
            );
        } catch (requestError) {
          inboxError =
            requestError;
        }

        if (
          list.length
        ) {
          setInboxItems(
            list
          );
        }

        if (!detail) {
          detail =
            list.find(
              (item) =>
                String(
                  item?.id
                ) ===
                String(
                  decodedId
                )
            ) ||
            null;
        }

        if (
          detail
        ) {
          setMessage(
            detail
          );
          setError("");

          if (
            successToast
          ) {
            notify(
              "success",
              "Message refreshed",
              "The latest synced email details are now visible."
            );
          }
        } else if (
          initialMessage &&
          String(
            initialMessage.id
          ) ===
            String(
              decodedId
            )
        ) {
          setMessage(
            initialMessage
          );

          const fallbackMessage =
            detailError?.message ||
            inboxError?.message ||
            "";

          setError(
            fallbackMessage
              ? `ReachFly could not refresh this message: ${fallbackMessage}`
              : ""
          );

          if (
            successToast
          ) {
            notify(
              "warning",
              "Showing saved message",
              "The live refresh was unavailable, so ReachFly kept the message already loaded from the inbox."
            );
          }
        } else {
          setMessage(
            null
          );

          const messageText =
            detailError?.message ||
            inboxError?.message ||
            "This email may no longer exist in the synced inbox.";

          setError(
            messageText
          );

          if (
            successToast
          ) {
            notify(
              "error",
              "Message refresh failed",
              messageText
            );
          }
        }

        setLoading(false);
        setRefreshing(false);
      },
      [
        decodedId,
        initialMessage,
      ]
    );

  useEffect(() => {
    let alive =
      true;

    const run =
      async () => {
        if (!alive) {
          return;
        }

        await load();
      };

    void run();

    return () => {
      alive = false;
    };
  }, [
    load,
  ]);

  const relatedMessages =
    useMemo(
      () =>
        buildRelatedMessages(
          inboxItems,
          message
        ),
      [
        inboxItems,
        message,
      ]
    );

  const context =
    useMemo(
      () =>
        buildMessageContext(
          message,
          relatedMessages
        ),
      [
        message,
        relatedMessages,
      ]
    );

  const backToInbox =
    message?.id
      ? `/app/inbox?message=${encodeURIComponent(
          message.id
        )}`
      : "/app/inbox";

  async function markRead() {
    if (
      !message?.id ||
      !message.unread ||
      markingRead
    ) {
      return;
    }

    try {
      setMarkingRead(
        true
      );

      await api.markInboxMessageRead(
        message.id
      );

      setMessage(
        (current) =>
          current
            ? {
                ...current,
                unread:
                  false,
              }
            : current
      );

      setInboxItems(
        (current) =>
          current.map(
            (item) =>
              String(
                item?.id
              ) ===
              String(
                message.id
              )
                ? {
                    ...item,
                    unread:
                      false,
                  }
                : item
          )
      );

      notify(
        "success",
        "Marked as read",
        "This inbox message is no longer unread."
      );
    } catch (requestError) {
      notify(
        "error",
        "Couldn't mark as read",
        requestError?.message ||
          "Please try again."
      );
    } finally {
      setMarkingRead(
        false
      );
    }
  }

  if (
    loading &&
    !message
  ) {
    return (
      <>
        <InboxDetailStyles />

        <InboxDetailSkeleton />
      </>
    );
  }

  if (!message) {
    return (
      <>
        <InboxDetailStyles />

        <div className="rf-inbox-detail-v7">
          <section className="rfid-fatal">
            <span className="rfid-fatal-icon">
              <InboxIcon size={22} />
            </span>

            <span className="rfid-eyebrow">
              Inbox message
            </span>

            <h1>
              Email not found
            </h1>

            <p>
              {error ||
                "This email may no longer exist in the synced inbox."}
            </p>

            <div className="rfid-fatal-actions">
              <button
                type="button"
                className="rfid-btn rfid-btn-primary"
                onClick={() =>
                  void load({
                    successToast: true,
                  })
                }
              >
                <RefreshCw size={14} />
                Try again
              </button>

              <Link
                className="rfid-btn rfid-btn-secondary"
                to="/app/inbox"
              >
                <ArrowLeft size={14} />
                Back to inbox
              </Link>
            </div>
          </section>
        </div>
      </>
    );
  }

  const channel =
    getChannel(
      message
    );

  const isWhatsApp =
    channel ===
    "whatsapp";

  const title =
    firstString(
      message.subject,
      message.title,
      "No subject"
    );

  const replyRecipient =
    getReplyRecipient(
      message,
      context
    );

  const replyHref =
    replyRecipient
      ? buildReplyMailto(
          replyRecipient,
          title
        )
      : "";

  const campaignHref =
    context.campaignId
      ? `/app/campaigns/${context.campaignId}`
      : "/app/campaigns";

  return (
    <>
      <InboxDetailStyles />

      <div className="rf-inbox-detail-v7">
        <div className="rfid-topbar">
          <Link
            to={
              backToInbox
            }
            className="rfid-back"
          >
            <ArrowLeft size={15} />
            Back to Inbox
          </Link>

          <div className="rfid-top-actions">
            {message.unread ? (
              <button
                type="button"
                className="rfid-btn rfid-btn-secondary"
                disabled={
                  markingRead
                }
                onClick={() =>
                  void markRead()
                }
              >
                {markingRead ? (
                  <RefreshCw
                    size={14}
                    className="spin"
                  />
                ) : (
                  <CheckCircle2 size={14} />
                )}

                Mark Read
              </button>
            ) : (
              <span className="rfid-read-pill">
                <CheckCircle2 size={13} />
                Read
              </span>
            )}

            <button
              type="button"
              className="rfid-icon-btn"
              title="Refresh message"
              aria-label="Refresh message"
              disabled={
                refreshing
              }
              onClick={() =>
                void load({
                  silent: true,
                  successToast: true,
                })
              }
            >
              <RefreshCw
                size={15}
                className={
                  refreshing
                    ? "spin"
                    : ""
                }
              />
            </button>
          </div>
        </div>

        {error ? (
          <section
            className="rfid-message warning"
            role="status"
          >
            <span>
              <RefreshCw size={14} />
            </span>

            <div>
              <strong>
                Showing the available message
              </strong>

              <small>
                {error}
              </small>
            </div>
          </section>
        ) : null}

        <section className="rfid-layout">
          <main className="rfid-main">
            <header className="rfid-message-header">
              <div className="rfid-message-heading">
                <span
                  className={`rfid-contact-avatar ${getAvatarTone(
                    context.name
                  )}`}
                >
                  {getInitials(
                    context.name
                  )}

                  <i
                    className={
                      channel
                    }
                  >
                    {isWhatsApp ? (
                      <MessageCircle size={8} />
                    ) : (
                      <Mail size={8} />
                    )}
                  </i>
                </span>

                <div>
                  <span className="rfid-eyebrow">
                    {getMessageKindLabel(
                      message
                    )}
                  </span>

                  <h1>
                    {title}
                  </h1>

                  <p>
                    {context.name}
                    {context.email
                      ? ` · ${context.email}`
                      : ""}
                  </p>
                </div>
              </div>

              <div className="rfid-statuses">
                <span
                  className={`rfid-direction ${
                    isInbound(
                      message
                    )
                      ? "inbound"
                      : "outbound"
                  }`}
                >
                  {isInbound(
                    message
                  )
                    ? "Received"
                    : "Sent"}
                </span>

                <span className="rfid-channel">
                  {isWhatsApp
                    ? "WhatsApp"
                    : "Email"}
                </span>

                {message.unread ? (
                  <span className="rfid-unread">
                    Unread
                  </span>
                ) : null}
              </div>
            </header>

            <section className="rfid-meta-grid">
              <MetaItem
                icon={
                  UserRound
                }
                label="From"
                value={
                  formatParty(
                    message.fromName,
                    message.fromEmail
                  ) ||
                  "Not available"
                }
              />

              <MetaItem
                icon={
                  InboxIcon
                }
                label="To"
                value={
                  formatParty(
                    message.toName,
                    message.toEmail
                  ) ||
                  "Not available"
                }
              />

              <MetaItem
                icon={
                  Calendar
                }
                label={
                  isInbound(
                    message
                  )
                    ? "Received"
                    : "Sent"
                }
                value={
                  formatDateTime(
                    message.createdAt
                  )
                }
              />

              <MetaItem
                icon={
                  Building2
                }
                label="Campaign"
                value={
                  context.campaignName ||
                  "Not linked"
                }
              />
            </section>

            <InsightCard
              message={
                message
              }
              context={
                context
              }
            />

            <article className="rfid-email-card">
              <div className="rfid-email-card-head">
                <div>
                  <span className="rfid-eyebrow">
                    Message content
                  </span>

                  <h2>
                    {isWhatsApp
                      ? "Message"
                      : "Email content"}
                  </h2>
                </div>

                <div className="rfid-email-time">
                  <Clock3 size={13} />

                  {formatRelativeOrDate(
                    message.createdAt
                  )}
                </div>
              </div>

              <div className="rfid-email-body">
                <StructuredEmailBody
                  value={
                    message.body ||
                    message.snippet ||
                    "No email body available."
                  }
                />
              </div>

              <footer className="rfid-email-foot">
                <span>
                  {isInbound(
                    message
                  )
                    ? "Received via connected inbox"
                    : "Sent from campaign activity"}
                </span>

                {message.provider ? (
                  <span>
                    Synced
                  </span>
                ) : null}
              </footer>
            </article>

            <section className="rfid-reply-card">
              <div className="rfid-reply-copy">
                <span>
                  <Mail size={15} />
                </span>

                <div>
                  <strong>
                    Reply from your mailbox
                  </strong>

                  <p>
                    ReachFly syncs this conversation, but the current inbox API
                    does not expose direct reply sending from this page.
                  </p>
                </div>
              </div>

              <div className="rfid-reply-actions">
                <Link
                  className="rfid-btn rfid-btn-secondary"
                  to="/app/email"
                >
                  Email settings
                </Link>

                {replyHref ? (
                  <a
                    className="rfid-btn rfid-btn-primary"
                    href={
                      replyHref
                    }
                  >
                    <Send size={14} />
                    Reply
                  </a>
                ) : (
                  <button
                    type="button"
                    className="rfid-btn rfid-btn-primary"
                    disabled
                  >
                    <Send size={14} />
                    Reply
                  </button>
                )}
              </div>
            </section>

            {relatedMessages.length >
            1 ? (
              <RelatedConversation
                messages={
                  relatedMessages
                }
                currentId={
                  message.id
                }
              />
            ) : null}
          </main>

          <aside className="rfid-sidebar">
            <section className="rfid-profile-card">
              <span
                className={`rfid-profile-avatar ${getAvatarTone(
                  context.name
                )}`}
              >
                {getInitials(
                  context.name
                )}
              </span>

              <h2>
                {context.name}
              </h2>

              <p>
                {context.company ||
                  context.campaignName ||
                  "Campaign contact"}
              </p>

              <div className="rfid-profile-actions">
                {context.email ? (
                  <a
                    href={`mailto:${context.email}`}
                    title="Email contact"
                  >
                    <Mail size={14} />
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="No email available"
                  >
                    <Mail size={14} />
                  </button>
                )}

                {context.phone ? (
                  <a
                    href={`tel:${context.phone}`}
                    title="Call contact"
                  >
                    <Phone size={14} />
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="No phone available"
                  >
                    <Phone size={14} />
                  </button>
                )}

                {context.website ? (
                  <a
                    href={normalizeWebsiteUrl(
                      context.website
                    )}
                    target="_blank"
                    rel="noreferrer"
                    title="Open website"
                  >
                    <Globe2 size={14} />
                  </a>
                ) : (
                  <button
                    type="button"
                    disabled
                    title="No website available"
                  >
                    <Globe2 size={14} />
                  </button>
                )}
              </div>
            </section>

            <SidebarSection
              title="Contact Details"
            >
              <SidebarLine
                icon={
                  <Mail size={13} />
                }
                label="Email"
                value={
                  context.email ||
                  "Not available"
                }
              />

              <SidebarLine
                icon={
                  <Phone size={13} />
                }
                label="Phone"
                value={
                  context.phone ||
                  "Not available"
                }
              />

              <SidebarLine
                icon={
                  <MapPin size={13} />
                }
                label="Location"
                value={
                  context.location ||
                  "Not available"
                }
              />

              <SidebarLine
                icon={
                  <Building2 size={13} />
                }
                label="Company"
                value={
                  context.company ||
                  "Not available"
                }
              />
            </SidebarSection>

            <SidebarSection
              title="Campaign"
            >
              <Link
                className="rfid-campaign-link"
                to={
                  campaignHref
                }
              >
                <span>
                  <InboxIcon size={13} />
                </span>

                <div>
                  <strong>
                    {context.campaignName ||
                      "Campaigns"}
                  </strong>

                  <small>
                    {context.campaignId
                      ? "Open campaign details"
                      : "View campaigns"}
                  </small>
                </div>

                <ExternalLink size={12} />
              </Link>
            </SidebarSection>

            <SidebarSection
              title="Message"
            >
              <dl className="rfid-detail-list">
                <DetailRow
                  label="Channel"
                  value={
                    isWhatsApp
                      ? "WhatsApp"
                      : "Email"
                  }
                />

                <DetailRow
                  label="Direction"
                  value={
                    isInbound(
                      message
                    )
                      ? "Inbound"
                      : "Outbound"
                  }
                />

                <DetailRow
                  label="Status"
                  value={
                    message.unread
                      ? "Unread"
                      : "Read"
                  }
                />

                <DetailRow
                  label="Time"
                  value={
                    formatDateTime(
                      message.createdAt
                    )
                  }
                />
              </dl>
            </SidebarSection>

            <SidebarSection
              title="Workspace"
            >
              <div className="rfid-workspace-links">
                <Link to="/app/inbox">
                  <InboxIcon size={13} />
                  Inbox
                </Link>

                <Link to="/app/contacts">
                  <UserRound size={13} />
                  Contacts
                </Link>

                <Link to="/app/audits">
                  <Sparkles size={13} />
                  AI Audits
                </Link>
              </div>
            </SidebarSection>
          </aside>
        </section>
      </div>
    </>
  );
}

function MetaItem({
  icon: Icon,
  label,
  value,
}) {
  return (
    <div className="rfid-meta-item">
      <span>
        <Icon size={15} />
      </span>

      <div>
        <small>
          {label}
        </small>

        <strong>
          {value}
        </strong>
      </div>
    </div>
  );
}

function InsightCard({
  message,
  context,
}) {
  const explicitSummary =
    firstString(
      message?.aiSummary,
      message?.summary,
      message?.analysis?.summary
    );

  const suggestedAction =
    firstString(
      message?.suggestedAction,
      message?.aiSuggestedAction,
      message?.analysis?.suggestedAction
    );

  const summary =
    explicitSummary ||
    buildDeterministicSummary(
      message,
      context.name
    );

  if (!summary) {
    return null;
  }

  return (
    <section
      className={`rfid-insight ${
        explicitSummary
          ? "ai"
          : ""
      }`}
    >
      <span>
        <Sparkles size={15} />
      </span>

      <div>
        <strong>
          {explicitSummary
            ? "AI Context Summary"
            : "Conversation Context"}
        </strong>

        <p>
          {summary}
        </p>

        {suggestedAction ? (
          <em>
            Suggested action:{" "}
            {suggestedAction}
          </em>
        ) : null}
      </div>
    </section>
  );
}

function RelatedConversation({
  messages,
  currentId,
}) {
  return (
    <section className="rfid-related">
      <div className="rfid-section-head">
        <div>
          <span className="rfid-eyebrow">
            Conversation
          </span>

          <h2>
            Related Messages
          </h2>
        </div>

        <span>
          {formatNumber(
            messages.length
          )}{" "}
          messages
        </span>
      </div>

      <div className="rfid-related-list">
        {messages.map(
          (
            item,
            index
          ) => {
            const current =
              String(
                item.id
              ) ===
              String(
                currentId
              );

            const inbound =
              isInbound(
                item
              );

            return (
              <Link
                key={
                  item.id ||
                  index
                }
                className={`rfid-related-row ${
                  current
                    ? "current"
                    : ""
                }`}
                to={`/app/inbox/${encodeURIComponent(
                  item.id
                )}`}
                state={{
                  message:
                    item,
                }}
              >
                <span
                  className={`rfid-related-icon ${
                    inbound
                      ? "inbound"
                      : "outbound"
                  }`}
                >
                  {inbound ? (
                    <Mail size={12} />
                  ) : (
                    <Send size={12} />
                  )}
                </span>

                <div>
                  <strong>
                    {inbound
                      ? "Reply received"
                      : "Campaign email sent"}
                  </strong>

                  <small>
                    {firstString(
                      item.subject,
                      item.title,
                      "No subject"
                    )}
                  </small>
                </div>

                <time>
                  {formatRelativeOrDate(
                    item.createdAt
                  )}
                </time>
              </Link>
            );
          }
        )}
      </div>
    </section>
  );
}

function SidebarSection({
  title,
  children,
}) {
  return (
    <section className="rfid-sidebar-section">
      <h3>
        {title}
      </h3>

      {children}
    </section>
  );
}

function SidebarLine({
  icon,
  label,
  value,
}) {
  return (
    <div className="rfid-sidebar-line">
      <span>
        {icon}
      </span>

      <div>
        <small>
          {label}
        </small>

        <strong>
          {value}
        </strong>
      </div>
    </div>
  );
}

function DetailRow({
  label,
  value,
}) {
  return (
    <div>
      <dt>
        {label}
      </dt>

      <dd>
        {value}
      </dd>
    </div>
  );
}

function StructuredEmailBody({
  value,
}) {
  const blocks =
    useMemo(
      () =>
        structureEmailBody(
          value
        ),
      [
        value,
      ]
    );

  if (
    !blocks.length
  ) {
    return (
      <p className="rfid-email-paragraph">
        No email body available.
      </p>
    );
  }

  return (
    <div className="rfid-structured-body">
      {blocks.map(
        (
          block,
          index
        ) => {
          if (
            block.type ===
            "bullets"
          ) {
            return (
              <ul
                className="rfid-email-bullets"
                key={
                  index
                }
              >
                {block.items.map(
                  (
                    item,
                    itemIndex
                  ) => (
                    <li
                      key={
                        itemIndex
                      }
                    >
                      <LinkifiedText
                        text={
                          item
                        }
                      />
                    </li>
                  )
                )}
              </ul>
            );
          }

          if (
            block.type ===
            "signature"
          ) {
            return (
              <div
                className="rfid-email-signature"
                key={
                  index
                }
              >
                {block.lines.map(
                  (
                    line,
                    lineIndex
                  ) => (
                    <p
                      key={
                        lineIndex
                      }
                    >
                      <LinkifiedText
                        text={
                          line
                        }
                      />
                    </p>
                  )
                )}
              </div>
            );
          }

          if (
            block.type ===
            "greeting"
          ) {
            return (
              <p
                className="rfid-email-greeting"
                key={
                  index
                }
              >
                <LinkifiedText
                  text={
                    block.text
                  }
                />
              </p>
            );
          }

          return (
            <p
              className="rfid-email-paragraph"
              key={
                index
              }
            >
              <LinkifiedText
                text={
                  block.text
                }
              />
            </p>
          );
        }
      )}
    </div>
  );
}

function InboxDetailSkeleton() {
  return (
    <div
      className="rf-inbox-detail-v7"
      aria-busy="true"
      aria-label="Loading inbox message"
    >
      <div className="rfid-skeleton-top">
        <i />
        <span>
          <i />
          <i />
        </span>
      </div>

      <div className="rfid-skeleton-layout">
        <main>
          <div className="rfid-skeleton-header">
            <i className="avatar" />

            <span>
              <i />
              <i className="title" />
              <i />
            </span>
          </div>

          <div className="rfid-skeleton-meta">
            {Array.from({
              length: 4,
            }).map(
              (
                _,
                index
              ) => (
                <i
                  key={
                    index
                  }
                />
              )
            )}
          </div>

          <i className="rfid-skeleton-insight" />
          <i className="rfid-skeleton-body" />
        </main>

        <aside>
          <i className="profile" />

          {Array.from({
            length: 4,
          }).map(
            (
              _,
              index
            ) => (
              <i
                key={
                  index
                }
              />
            )
          )}
        </aside>
      </div>
    </div>
  );
}

/* ==========================================================================
 * Message / conversation data
 * ======================================================================= */

function unwrapMessage(
  value
) {
  if (
    !value ||
    Array.isArray(
      value
    )
  ) {
    return value ||
      null;
  }

  return (
    value.message ||
    value.item ||
    value.data?.message ||
    value.data?.item ||
    value.data ||
    value
  );
}

function normalizeInboxResponse(
  response
) {
  if (
    Array.isArray(
      response
    )
  ) {
    return response;
  }

  if (
    Array.isArray(
      response?.items
    )
  ) {
    return response.items;
  }

  if (
    Array.isArray(
      response?.messages
    )
  ) {
    return response.messages;
  }

  if (
    Array.isArray(
      response?.data
    )
  ) {
    return response.data;
  }

  if (
    Array.isArray(
      response?.data?.items
    )
  ) {
    return response.data.items;
  }

  return [];
}

function buildRelatedMessages(
  items,
  message
) {
  if (!message) {
    return [];
  }

  const threadId =
    firstString(
      message.threadId,
      message.conversationId
    );

  const replyRoot =
    firstString(
      message.replyToSentId,
      message.parentMessageId
    );

  const campaignId =
    firstString(
      message.campaignId
    );

  const counterpart =
    normalizeEmail(
      isInbound(
        message
      )
        ? message.fromEmail
        : message.toEmail
    );

  const candidates =
    items.filter(
      (item) => {
        if (
          String(
            item?.id
          ) ===
          String(
            message.id
          )
        ) {
          return true;
        }

        if (
          threadId &&
          firstString(
            item.threadId,
            item.conversationId
          ) ===
            threadId
        ) {
          return true;
        }

        if (
          replyRoot &&
          [
            item.replyToSentId,
            item.parentMessageId,
            item.id,
          ]
            .filter(Boolean)
            .map(String)
            .includes(
              String(
                replyRoot
              )
            )
        ) {
          return true;
        }

        if (
          counterpart &&
          campaignId &&
          String(
            item.campaignId ||
              ""
          ) ===
            String(
              campaignId
            )
        ) {
          const itemCounterpart =
            normalizeEmail(
              isInbound(
                item
              )
                ? item.fromEmail
                : item.toEmail
            );

          return (
            itemCounterpart ===
            counterpart
          );
        }

        return false;
      }
    );

  const map =
    new Map();

  [
    ...candidates,
    message,
  ].forEach(
    (item) => {
      const key =
        String(
          item?.id ||
          `${item?.createdAt || ""}-${item?.subject || ""}-${item?.direction || ""}`
        );

      if (
        !map.has(
          key
        )
      ) {
        map.set(
          key,
          item
        );
      }
    }
  );

  return Array.from(
    map.values()
  ).sort(
    (
      left,
      right
    ) =>
      getTimestamp(
        left.createdAt
      ) -
      getTimestamp(
        right.createdAt
      )
  );
}

function buildMessageContext(
  message,
  relatedMessages
) {
  if (!message) {
    return {
      name:
        "Campaign contact",
      email:
        "",
      phone:
        "",
      company:
        "",
      location:
        "",
      website:
        "",
      campaignName:
        "",
      campaignId:
        "",
    };
  }

  const inbound =
    [...relatedMessages]
      .reverse()
      .find(
        isInbound
      );

  const outbound =
    [...relatedMessages]
      .reverse()
      .find(
        isOutbound
      );

  const source =
    inbound ||
    message ||
    outbound ||
    {};

  return {
    name:
      firstString(
        isInbound(
          source
        )
          ? source.fromName
          : source.toName,
        source.leadName,
        source.contactName,
        source.fromName,
        source.toName,
        inbound?.fromName,
        outbound?.toName,
        isInbound(
          source
        )
          ? source.fromEmail
          : source.toEmail,
        "Campaign contact"
      ),
    email:
      firstString(
        isInbound(
          source
        )
          ? source.fromEmail
          : source.toEmail,
        source.leadEmail,
        source.contactEmail,
        inbound?.fromEmail,
        outbound?.toEmail
      ),
    phone:
      firstString(
        source.phone,
        source.phoneNumber,
        source.leadPhone,
        source.contactPhone,
        inbound?.phone,
        outbound?.phone
      ),
    company:
      firstString(
        source.companyName,
        source.business,
        source.organization,
        source.accountName,
        inbound?.companyName,
        outbound?.companyName
      ),
    location:
      firstString(
        source.location,
        source.city,
        source.address,
        source.formattedAddress,
        inbound?.location,
        outbound?.location
      ),
    website:
      firstString(
        source.website,
        source.websiteUrl,
        source.domain,
        inbound?.website,
        outbound?.website
      ),
    campaignName:
      firstString(
        message.campaignName,
        source.campaignName,
        inbound?.campaignName,
        outbound?.campaignName
      ),
    campaignId:
      firstString(
        message.campaignId,
        source.campaignId,
        inbound?.campaignId,
        outbound?.campaignId
      ),
  };
}

function getMessageKindLabel(
  message
) {
  const channel =
    getChannel(
      message
    );

  if (
    channel ===
    "whatsapp"
  ) {
    return isInbound(
      message
    )
      ? "WhatsApp message"
      : "WhatsApp outreach";
  }

  if (
    message?.source ===
    "mailbox"
  ) {
    return isInbound(
      message
    )
      ? "Mailbox email"
      : "Mailbox activity";
  }

  return isInbound(
    message
  )
    ? "Campaign reply"
    : "Campaign email";
}

function isInbound(
  message
) {
  return (
    message?.direction ===
    "inbound"
  );
}

function isOutbound(
  message
) {
  return (
    message?.direction ===
    "outbound"
  );
}

function getChannel(
  message
) {
  return String(
    message?.channel ||
    "email"
  ).toLowerCase();
}

function getReplyRecipient(
  message,
  context
) {
  if (
    isInbound(
      message
    )
  ) {
    return firstString(
      message.fromEmail,
      context.email
    );
  }

  return firstString(
    context.email,
    message?.toEmail
  );
}

function buildReplyMailto(
  recipient,
  subject
) {
  const clean =
    String(
      subject ||
      ""
    )
      .replace(
        /^re:\s*/i,
        ""
      )
      .trim();

  const params =
    new URLSearchParams();

  if (clean) {
    params.set(
      "subject",
      `Re: ${clean}`
    );
  }

  return `mailto:${recipient}${
    params.toString()
      ? `?${params.toString()}`
      : ""
  }`;
}

function buildDeterministicSummary(
  message,
  name
) {
  if (
    !message ||
    !isInbound(
      message
    )
  ) {
    return "";
  }

  const subject =
    firstString(
      message.subject,
      message.title,
      "the campaign email"
    );

  const preview =
    String(
      message.snippet ||
      message.body ||
      ""
    )
      .replace(
        /<[^>]+>/g,
        " "
      )
      .replace(
        /\s+/g,
        " "
      )
      .trim();

  if (!preview) {
    return `${name} replied to ${subject}.`;
  }

  const shortened =
    preview.length >
    220
      ? `${preview.slice(
          0,
          217
        )}…`
      : preview;

  return `${name} replied to ${subject}: ${shortened}`;
}

/* ==========================================================================
 * Structured email renderer — preserved from the existing screen
 * ======================================================================= */

function structureEmailBody(
  value
) {
  const prepared =
    prepareEmailText(
      value
    );

  if (!prepared) {
    return [];
  }

  const lines =
    prepared
      .split("\n")
      .map(
        (line) =>
          line.trim()
      )
      .filter(Boolean);

  const blocks =
    [];

  let bulletBuffer =
    [];

  let signatureBuffer =
    [];

  let inSignature =
    false;

  const flushBullets =
    () => {
      if (
        !bulletBuffer.length
      ) {
        return;
      }

      blocks.push({
        type:
          "bullets",
        items:
          bulletBuffer,
      });

      bulletBuffer =
        [];
    };

  const flushSignature =
    () => {
      if (
        !signatureBuffer.length
      ) {
        return;
      }

      blocks.push({
        type:
          "signature",
        lines:
          signatureBuffer,
      });

      signatureBuffer =
        [];
    };

  lines.forEach(
    (
      line,
      index
    ) => {
      const cleaned =
        line
          .replace(
            /^[-•*]\s*/,
            ""
          )
          .trim();

      const isBullet =
        /^[-•*]\s+/.test(
          line
        );

      const isFirstShortGreeting =
        index ===
          0 &&
        /^[a-z0-9\s.'-]{2,45},$/i.test(
          line
        ) &&
        !line.includes(
          "@"
        );

      const startsSignature =
        /^(best regards|regards|kind regards|thanks|thank you|sincerely|cheers|warm regards|best,|regards,)/i.test(
          line
        );

      if (isBullet) {
        flushSignature();
        bulletBuffer.push(
          cleaned
        );
        return;
      }

      flushBullets();

      if (
        startsSignature
      ) {
        inSignature =
          true;

        signatureBuffer.push(
          line
        );

        return;
      }

      if (
        inSignature
      ) {
        signatureBuffer.push(
          line
        );

        return;
      }

      if (
        isFirstShortGreeting
      ) {
        blocks.push({
          type:
            "greeting",
          text:
            line,
        });

        return;
      }

      blocks.push({
        type:
          "paragraph",
        text:
          line,
      });
    }
  );

  flushBullets();
  flushSignature();

  return blocks;
}

function prepareEmailText(
  value
) {
  let text =
    decodeEntities(
      String(
        value ||
        ""
      )
    )
      .replace(
        /\r\n/g,
        "\n"
      )
      .replace(
        /\r/g,
        "\n"
      )
      .replace(
        /<br\s*\/?>/gi,
        "\n"
      )
      .replace(
        /<\/p>/gi,
        "\n\n"
      )
      .replace(
        /<[^>]+>/g,
        " "
      )
      .replace(
        /\u00a0/g,
        " "
      )
      .replace(
        /[ \t]+/g,
        " "
      )
      .replace(
        /\s+•\s+/g,
        "\n• "
      )
      .replace(
        /\s+-\s+(?=[A-Za-z0-9])/g,
        "\n- "
      )
      .trim();

  if (
    !text.includes(
      "\n"
    )
  ) {
    text =
      text
        .replace(
          /^([A-Za-z0-9\s.'-]{2,45},)\s+/,
          "$1\n\n"
        )
        .replace(
          /\s+(Best regards|Kind regards|Warm regards|Regards|Thanks|Thank you|Sincerely|Cheers)[,.\s]/i,
          "\n\n$1 "
        )
        .replace(
          /([.!?])\s+(?=(?:Perhaps|With|When|While|My|Our|Your|This|That|Please|If|For|Also|Let|Best|Regards|Thanks|Thank|Sincerely|Cheers)\b)/g,
          "$1\n\n"
        );
  }

  return text
    .replace(
      /\n{3,}/g,
      "\n\n"
    )
    .split("\n")
    .map(
      (line) =>
        line.trim()
    )
    .join("\n")
    .trim();
}

function LinkifiedText({
  text,
}) {
  const parts =
    String(
      text ||
      ""
    ).split(
      /(https?:\/\/[^\s]+|www\.[^\s]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi
    );

  return (
    <>
      {parts.map(
        (
          part,
          index
        ) => {
          if (
            /^https?:\/\//i.test(
              part
            )
          ) {
            return (
              <a
                key={
                  index
                }
                href={
                  part
                }
                target="_blank"
                rel="noreferrer"
              >
                {part}
              </a>
            );
          }

          if (
            /^www\./i.test(
              part
            )
          ) {
            return (
              <a
                key={
                  index
                }
                href={`https://${part}`}
                target="_blank"
                rel="noreferrer"
              >
                {part}
              </a>
            );
          }

          if (
            /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(
              part
            )
          ) {
            return (
              <a
                key={
                  index
                }
                href={`mailto:${part}`}
              >
                {part}
              </a>
            );
          }

          return part;
        }
      )}
    </>
  );
}

function decodeEntities(
  value
) {
  return String(
    value ||
    ""
  )
    .replace(
      /&nbsp;/gi,
      " "
    )
    .replace(
      /&amp;/gi,
      "&"
    )
    .replace(
      /&lt;/gi,
      "<"
    )
    .replace(
      /&gt;/gi,
      ">"
    )
    .replace(
      /&quot;/gi,
      '"'
    )
    .replace(
      /&#39;/gi,
      "'"
    );
}

/* ==========================================================================
 * Utilities
 * ======================================================================= */

function firstString(
  ...values
) {
  for (const value of values) {
    if (
      value ===
        null ||
      value ===
        undefined
    ) {
      continue;
    }

    const text =
      String(
        value
      ).trim();

    if (text) {
      return text;
    }
  }

  return "";
}

function formatParty(
  name,
  email
) {
  const cleanName =
    firstString(
      name
    );

  const cleanEmail =
    firstString(
      email
    );

  if (
    cleanName &&
    cleanEmail
  ) {
    return `${cleanName} · ${cleanEmail}`;
  }

  return (
    cleanName ||
    cleanEmail ||
    ""
  );
}

function normalizeEmail(
  value
) {
  return String(
    value ||
    ""
  )
    .trim()
    .toLowerCase();
}

function normalizeWebsiteUrl(
  value
) {
  const text =
    String(
      value ||
      ""
    ).trim();

  if (!text) {
    return "#";
  }

  if (
    /^https?:\/\//i.test(
      text
    )
  ) {
    return text;
  }

  return `https://${text}`;
}

function getTimestamp(
  value
) {
  if (!value) {
    return 0;
  }

  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? 0
    : date.getTime();
}

function formatDateTime(
  value
) {
  if (!value) {
    return "Unknown time";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown time";
  }

  return date.toLocaleString(
    undefined,
    {
      month:
        "short",
      day:
        "numeric",
      year:
        "numeric",
      hour:
        "numeric",
      minute:
        "2-digit",
    }
  );
}

function formatRelativeOrDate(
  value
) {
  if (!value) {
    return "Unknown time";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "Unknown time";
  }

  const delta =
    Date.now() -
    date.getTime();

  if (
    delta >=
      0 &&
    delta <
      60 *
        1000
  ) {
    return "Just now";
  }

  if (
    delta >=
      0 &&
    delta <
      60 *
        60 *
        1000
  ) {
    const minutes =
      Math.max(
        1,
        Math.floor(
          delta /
            (
              60 *
              1000
            )
        )
      );

    return `${minutes} min${
      minutes ===
      1
        ? ""
        : "s"
    } ago`;
  }

  if (
    delta >=
      0 &&
    delta <
      24 *
        60 *
        60 *
        1000
  ) {
    const hours =
      Math.max(
        1,
        Math.floor(
          delta /
            (
              60 *
              60 *
              1000
            )
        )
      );

    return `${hours} hr${
      hours ===
      1
        ? ""
        : "s"
    } ago`;
  }

  return date.toLocaleDateString(
    undefined,
    {
      month:
        "short",
      day:
        "numeric",
      year:
        date.getFullYear() ===
        new Date().getFullYear()
          ? undefined
          : "numeric",
    }
  );
}

function formatNumber(
  value
) {
  const number =
    Number(
      value
    );

  return Number.isFinite(
    number
  )
    ? new Intl.NumberFormat().format(
        Math.round(
          number
        )
      )
    : "0";
}

function getInitials(
  value
) {
  const parts =
    String(
      value ||
        "RF"
    )
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  if (
    parts.length ===
    1
  ) {
    return parts[0]
      .slice(
        0,
        2
      )
      .toUpperCase();
  }

  return parts
    .slice(
      0,
      2
    )
    .map(
      (part) =>
        part[0]
    )
    .join("")
    .toUpperCase();
}

function getAvatarTone(
  value
) {
  const tones = [
    "primary",
    "violet",
    "blue",
    "green",
    "amber",
  ];

  const sum =
    String(
      value ||
        ""
    )
      .split("")
      .reduce(
        (
          total,
          character
        ) =>
          total +
          character.charCodeAt(
            0
          ),
        0
      );

  return tones[
    sum %
      tones.length
  ];
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
    bridge[type](
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

/* ==========================================================================
 * Scoped Stitch styling
 * ======================================================================= */

function InboxDetailStyles() {
  return (
    <style>{`
      .rf-inbox-detail-v7{
        --rfid-card:#fff;
        --rfid-soft:#f3f4f5;
        --rfid-high:#e7e8e9;
        --rfid-text:#191c1d;
        --rfid-text-soft:#464554;
        --rfid-muted:#767586;
        --rfid-outline:#e3e5e7;
        --rfid-primary:#4648d4;
        --rfid-primary-dark:#3537bb;
        --rfid-primary-soft:#e8e9ff;
        --rfid-violet:#6b38d4;
        --rfid-violet-soft:#f0eaff;
        --rfid-success:#087a51;
        --rfid-success-soft:#dcfce7;
        --rfid-warning:#845d00;
        --rfid-warning-soft:#fff4d6;
        --rfid-danger:#ba1a1a;
        --rfid-danger-soft:#ffedeb;
        --rfid-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:22px 30px 42px;
        color:var(--rfid-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfidPageIn 260ms var(--rfid-ease);
      }

      .rf-inbox-detail-v7 *,
      .rf-inbox-detail-v7 *::before,
      .rf-inbox-detail-v7 *::after{
        box-sizing:border-box;
      }

      .rf-inbox-detail-v7 a{
        color:inherit;
      }

      .rf-inbox-detail-v7 .spin{
        animation:rfidSpin 800ms linear infinite;
      }

      @keyframes rfidPageIn{
        from{opacity:0;transform:translate3d(0,6px,0)}
        to{opacity:1;transform:translate3d(0,0,0)}
      }

      @keyframes rfidFadeUp{
        from{opacity:0;transform:translate3d(0,7px,0)}
        to{opacity:1;transform:translate3d(0,0,0)}
      }

      @keyframes rfidScaleIn{
        from{opacity:0;transform:scale(.986)}
        to{opacity:1;transform:scale(1)}
      }

      @keyframes rfidSpin{
        to{transform:rotate(360deg)}
      }

      @keyframes rfidShimmer{
        from{background-position:200% 0}
        to{background-position:-200% 0}
      }

      .rfid-topbar{
        min-height:40px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        margin-bottom:12px;
      }

      .rfid-back{
        display:inline-flex;
        align-items:center;
        gap:6px;
        color:var(--rfid-text-soft)!important;
        text-decoration:none;
        font-size:10px;
        font-weight:650;
        transition:
          color 140ms var(--rfid-ease),
          transform 140ms var(--rfid-ease);
      }

      .rfid-back:hover{
        color:var(--rfid-primary)!important;
        transform:translateX(-1px);
      }

      .rfid-top-actions{
        display:flex;
        align-items:center;
        gap:7px;
      }

      .rfid-btn{
        appearance:none;
        min-height:37px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 11px;
        color:inherit;
        border:1px solid transparent;
        border-radius:8px;
        text-decoration:none;
        cursor:pointer;
        font:600 9px/14px Inter,sans-serif;
        transition:
          color 140ms var(--rfid-ease),
          background 140ms var(--rfid-ease),
          border-color 140ms var(--rfid-ease),
          transform 140ms var(--rfid-ease),
          box-shadow 140ms var(--rfid-ease);
      }

      .rfid-btn:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rfid-btn:active:not(:disabled){
        transform:translateY(0) scale(.985);
      }

      .rfid-btn:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rfid-btn-primary{
        color:#fff!important;
        background:var(--rfid-primary);
        border-color:var(--rfid-primary);
        box-shadow:0 4px 12px rgba(70,72,212,.16);
      }

      .rfid-btn-primary:hover:not(:disabled){
        background:var(--rfid-primary-dark);
        border-color:var(--rfid-primary-dark);
      }

      .rfid-btn-secondary{
        color:var(--rfid-text)!important;
        background:#fff;
        border-color:var(--rfid-outline);
      }

      .rfid-btn-secondary:hover:not(:disabled){
        color:var(--rfid-primary)!important;
        background:var(--rfid-primary-soft);
        border-color:rgba(70,72,212,.18);
      }

      .rfid-icon-btn{
        width:37px;
        height:37px;
        display:grid;
        place-items:center;
        padding:0;
        color:var(--rfid-text-soft);
        background:#fff;
        border:1px solid var(--rfid-outline);
        border-radius:8px;
        cursor:pointer;
      }

      .rfid-icon-btn:hover:not(:disabled){
        color:var(--rfid-primary);
        background:var(--rfid-primary-soft);
      }

      .rfid-icon-btn:disabled{
        opacity:.45;
      }

      .rfid-read-pill{
        min-height:34px;
        display:inline-flex;
        align-items:center;
        gap:5px;
        padding:6px 9px;
        color:var(--rfid-success);
        background:var(--rfid-success-soft);
        border-radius:7px;
        font-size:8px;
        font-weight:700;
      }

      .rfid-message{
        display:flex;
        align-items:flex-start;
        gap:9px;
        padding:9px 11px;
        margin-bottom:12px;
        border:1px solid;
        border-radius:8px;
        animation:rfidFadeUp 180ms var(--rfid-ease);
      }

      .rfid-message.warning{
        color:#725000;
        background:var(--rfid-warning-soft);
        border-color:#efdc9c;
      }

      .rfid-message > span{
        width:25px;
        height:25px;
        display:grid;
        place-items:center;
        flex:0 0 25px;
        background:rgba(255,255,255,.65);
        border-radius:6px;
      }

      .rfid-message > div{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .rfid-message strong{
        font-size:9px;
        line-height:13px;
      }

      .rfid-message small{
        font-size:8px;
        line-height:13px;
      }

      .rfid-layout{
        display:grid;
        grid-template-columns:minmax(0,1fr) 300px;
        gap:20px;
        align-items:start;
      }

      .rfid-main{
        min-width:0;
        display:grid;
        gap:14px;
      }

      .rfid-message-header{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:20px;
        padding:21px 23px;
        background:#fff;
        border:1px solid var(--rfid-outline);
        border-radius:14px;
        box-shadow:0 1px 3px rgba(25,28,29,.035);
        animation:rfidScaleIn 250ms var(--rfid-ease);
      }

      .rfid-message-heading{
        min-width:0;
        display:flex;
        align-items:flex-start;
        gap:12px;
      }

      .rfid-contact-avatar{
        position:relative;
        width:46px;
        height:46px;
        display:grid;
        place-items:center;
        flex:0 0 46px;
        color:#fff;
        border-radius:50%;
        font-size:10px;
        font-weight:800;
      }

      .rfid-contact-avatar.primary,
      .rfid-profile-avatar.primary{
        background:#5b5ddd;
      }

      .rfid-contact-avatar.violet,
      .rfid-profile-avatar.violet{
        background:#7546d9;
      }

      .rfid-contact-avatar.blue,
      .rfid-profile-avatar.blue{
        background:#3772b9;
      }

      .rfid-contact-avatar.green,
      .rfid-profile-avatar.green{
        background:#23845f;
      }

      .rfid-contact-avatar.amber,
      .rfid-profile-avatar.amber{
        background:#a06e25;
      }

      .rfid-contact-avatar > i{
        position:absolute;
        right:-1px;
        bottom:-1px;
        width:16px;
        height:16px;
        display:grid;
        place-items:center;
        color:var(--rfid-primary);
        background:#fff;
        border:2px solid #fff;
        border-radius:50%;
      }

      .rfid-contact-avatar > i.whatsapp{
        color:var(--rfid-success);
      }

      .rfid-message-heading > div{
        min-width:0;
      }

      .rfid-eyebrow{
        display:block;
        margin-bottom:3px;
        color:var(--rfid-primary);
        font-size:8px;
        font-weight:750;
        line-height:12px;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rfid-message-heading h1,
      .rfid-fatal h1{
        max-width:760px;
        margin:0;
        color:var(--rfid-text);
        font:600 24px/31px Geist,Inter,sans-serif;
        letter-spacing:-.018em;
      }

      .rfid-message-heading p{
        margin:4px 0 0;
        overflow:hidden;
        color:var(--rfid-text-soft);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:9px;
        line-height:14px;
      }

      .rfid-statuses{
        display:flex;
        flex-wrap:wrap;
        justify-content:flex-end;
        gap:5px;
        flex:0 0 auto;
      }

      .rfid-statuses > span{
        min-height:22px;
        display:inline-flex;
        align-items:center;
        padding:4px 7px;
        border-radius:999px;
        font-size:7px;
        font-weight:750;
        line-height:10px;
        letter-spacing:.04em;
        text-transform:uppercase;
      }

      .rfid-direction.inbound{
        color:var(--rfid-primary);
        background:var(--rfid-primary-soft);
      }

      .rfid-direction.outbound{
        color:#5d6474;
        background:#eef1f5;
      }

      .rfid-channel{
        color:var(--rfid-violet);
        background:var(--rfid-violet-soft);
      }

      .rfid-unread{
        color:var(--rfid-success);
        background:var(--rfid-success-soft);
      }

      .rfid-meta-grid{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:10px;
      }

      .rfid-meta-item{
        min-width:0;
        display:flex;
        align-items:flex-start;
        gap:8px;
        padding:12px;
        background:#fff;
        border:1px solid var(--rfid-outline);
        border-radius:10px;
      }

      .rfid-meta-item > span{
        width:29px;
        height:29px;
        display:grid;
        place-items:center;
        flex:0 0 29px;
        color:var(--rfid-primary);
        background:var(--rfid-primary-soft);
        border-radius:7px;
      }

      .rfid-meta-item > div{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .rfid-meta-item small{
        color:var(--rfid-muted);
        font-size:6px;
        line-height:9px;
        letter-spacing:.06em;
        text-transform:uppercase;
      }

      .rfid-meta-item strong{
        overflow:hidden;
        color:var(--rfid-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:8px;
        line-height:12px;
      }

      .rfid-insight{
        display:flex;
        gap:10px;
        padding:14px 15px;
        background:#f1f1f8;
        border-left:3px solid var(--rfid-outline);
        border-radius:10px;
        animation:rfidFadeUp 220ms var(--rfid-ease);
      }

      .rfid-insight.ai{
        background:#f0f0fb;
        border-left-color:var(--rfid-violet);
      }

      .rfid-insight > span{
        width:29px;
        height:29px;
        display:grid;
        place-items:center;
        flex:0 0 29px;
        color:var(--rfid-violet);
        background:#fff;
        border-radius:50%;
      }

      .rfid-insight > div{
        min-width:0;
        display:grid;
        gap:3px;
      }

      .rfid-insight strong{
        color:var(--rfid-text);
        font-size:8px;
        font-weight:800;
        line-height:12px;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rfid-insight p{
        margin:0;
        color:var(--rfid-text-soft);
        font-size:9px;
        line-height:15px;
      }

      .rfid-insight em{
        color:var(--rfid-violet);
        font-size:8px;
        font-style:normal;
        font-weight:650;
        line-height:13px;
      }

      .rfid-email-card,
      .rfid-related,
      .rfid-reply-card{
        background:#fff;
        border:1px solid var(--rfid-outline);
        border-radius:14px;
        box-shadow:0 1px 3px rgba(25,28,29,.03);
      }

      .rfid-email-card{
        overflow:hidden;
      }

      .rfid-email-card-head,
      .rfid-section-head{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:16px;
        padding:16px 18px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rfid-outline);
      }

      .rfid-email-card-head h2,
      .rfid-section-head h2{
        margin:0;
        color:var(--rfid-text);
        font:600 13px/18px Geist,Inter,sans-serif;
      }

      .rfid-email-time{
        display:flex;
        align-items:center;
        gap:5px;
        color:var(--rfid-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfid-email-body{
        min-height:300px;
        padding:30px 36px;
      }

      .rfid-structured-body{
        max-width:780px;
        margin:0 auto;
        color:#282a2c;
      }

      .rfid-email-greeting,
      .rfid-email-paragraph,
      .rfid-email-bullets li,
      .rfid-email-signature p{
        color:inherit;
        font-size:11px;
        line-height:1.75;
      }

      .rfid-email-greeting{
        margin:0 0 18px;
        font-weight:600;
      }

      .rfid-email-paragraph{
        margin:0 0 17px;
      }

      .rfid-email-bullets{
        display:grid;
        gap:7px;
        margin:0 0 18px;
        padding-left:22px;
      }

      .rfid-email-bullets li{
        padding-left:2px;
      }

      .rfid-email-signature{
        padding-top:16px;
        margin-top:23px;
        border-top:1px solid #eceef0;
      }

      .rfid-email-signature p{
        margin:0 0 3px;
        color:var(--rfid-text-soft);
      }

      .rfid-structured-body a{
        color:var(--rfid-primary)!important;
        text-decoration:none;
        word-break:break-word;
      }

      .rfid-structured-body a:hover{
        text-decoration:underline;
      }

      .rfid-email-foot{
        min-height:43px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:10px 18px;
        color:var(--rfid-muted);
        background:#fbfbfc;
        border-top:1px solid var(--rfid-outline);
        font-size:7px;
        line-height:10px;
      }

      .rfid-email-foot > span:last-child{
        color:var(--rfid-success);
      }

      .rfid-reply-card{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:14px;
        padding:14px 15px;
      }

      .rfid-reply-copy{
        min-width:0;
        display:flex;
        align-items:flex-start;
        gap:9px;
      }

      .rfid-reply-copy > span{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        flex:0 0 31px;
        color:var(--rfid-primary);
        background:var(--rfid-primary-soft);
        border-radius:8px;
      }

      .rfid-reply-copy > div{
        min-width:0;
      }

      .rfid-reply-copy strong{
        display:block;
        color:var(--rfid-text);
        font-size:9px;
        line-height:13px;
      }

      .rfid-reply-copy p{
        max-width:560px;
        margin:2px 0 0;
        color:var(--rfid-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfid-reply-actions{
        flex:0 0 auto;
        display:flex;
        gap:6px;
      }

      .rfid-related{
        overflow:hidden;
      }

      .rfid-section-head > span{
        color:var(--rfid-muted);
        font-size:8px;
        line-height:12px;
      }

      .rfid-related-list{
        display:grid;
      }

      .rfid-related-row{
        min-height:55px;
        display:flex;
        align-items:center;
        gap:9px;
        padding:10px 15px;
        color:inherit!important;
        border-top:1px solid #f0f1f2;
        text-decoration:none;
        transition:
          background 140ms var(--rfid-ease),
          box-shadow 140ms var(--rfid-ease);
      }

      .rfid-related-row:first-child{
        border-top:0;
      }

      .rfid-related-row:hover{
        background:#fafafd;
      }

      .rfid-related-row.current{
        background:#f3f3ff;
        box-shadow:inset 3px 0 0 var(--rfid-primary);
      }

      .rfid-related-icon{
        width:28px;
        height:28px;
        display:grid;
        place-items:center;
        flex:0 0 28px;
        border-radius:50%;
      }

      .rfid-related-icon.inbound{
        color:var(--rfid-primary);
        background:var(--rfid-primary-soft);
      }

      .rfid-related-icon.outbound{
        color:#5d6474;
        background:#eef1f5;
      }

      .rfid-related-row > div{
        min-width:0;
        flex:1;
        display:grid;
        gap:0;
      }

      .rfid-related-row strong,
      .rfid-related-row small{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .rfid-related-row strong{
        color:var(--rfid-text);
        font-size:8px;
        line-height:12px;
      }

      .rfid-related-row small{
        color:var(--rfid-muted);
        font-size:7px;
        line-height:10px;
      }

      .rfid-related-row time{
        flex:0 0 auto;
        color:var(--rfid-muted);
        font-size:7px;
      }

      .rfid-sidebar{
        min-width:0;
        overflow:hidden;
        background:#fff;
        border:1px solid var(--rfid-outline);
        border-radius:14px;
        box-shadow:0 1px 3px rgba(25,28,29,.03);
      }

      .rfid-profile-card{
        display:grid;
        justify-items:center;
        gap:3px;
        padding:22px 18px 18px;
        text-align:center;
        background:
          radial-gradient(circle at 80% 0,rgba(70,72,212,.085),transparent 34%),
          #fff;
        border-bottom:1px solid var(--rfid-outline);
      }

      .rfid-profile-avatar{
        width:64px;
        height:64px;
        display:grid;
        place-items:center;
        margin-bottom:5px;
        color:#fff;
        border:4px solid #fff;
        border-radius:50%;
        box-shadow:0 5px 15px rgba(25,28,29,.12);
        font-size:15px;
        font-weight:800;
      }

      .rfid-profile-card h2{
        margin:0;
        color:var(--rfid-text);
        font:600 14px/19px Geist,Inter,sans-serif;
      }

      .rfid-profile-card p{
        margin:0;
        color:var(--rfid-text-soft);
        font-size:8px;
        line-height:12px;
      }

      .rfid-profile-actions{
        display:flex;
        align-items:center;
        gap:6px;
        margin-top:7px;
      }

      .rfid-profile-actions a,
      .rfid-profile-actions button{
        width:31px;
        height:31px;
        display:grid;
        place-items:center;
        padding:0;
        color:var(--rfid-text-soft);
        background:var(--rfid-soft);
        border:0;
        border-radius:50%;
        text-decoration:none;
        cursor:pointer;
      }

      .rfid-profile-actions a:hover{
        color:var(--rfid-primary);
        background:var(--rfid-primary-soft);
      }

      .rfid-profile-actions button:disabled{
        opacity:.35;
        cursor:not-allowed;
      }

      .rfid-sidebar-section{
        padding:16px 17px;
        border-bottom:1px solid var(--rfid-outline);
      }

      .rfid-sidebar-section:last-child{
        border-bottom:0;
      }

      .rfid-sidebar-section h3{
        margin:0 0 10px;
        color:var(--rfid-text-soft);
        font-size:8px;
        font-weight:750;
        line-height:12px;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rfid-sidebar-line{
        min-height:38px;
        display:flex;
        align-items:center;
        gap:8px;
      }

      .rfid-sidebar-line > span{
        width:27px;
        height:27px;
        display:grid;
        place-items:center;
        flex:0 0 27px;
        color:var(--rfid-primary);
        background:var(--rfid-primary-soft);
        border-radius:7px;
      }

      .rfid-sidebar-line > div{
        min-width:0;
        display:grid;
        gap:0;
      }

      .rfid-sidebar-line small{
        color:var(--rfid-muted);
        font-size:6px;
        line-height:9px;
      }

      .rfid-sidebar-line strong{
        overflow:hidden;
        color:var(--rfid-text);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:8px;
        line-height:12px;
      }

      .rfid-campaign-link{
        min-height:44px;
        display:flex;
        align-items:center;
        gap:8px;
        padding:7px;
        color:inherit!important;
        background:var(--rfid-soft);
        border-radius:8px;
        text-decoration:none;
      }

      .rfid-campaign-link:hover{
        background:var(--rfid-primary-soft);
      }

      .rfid-campaign-link > span{
        width:29px;
        height:29px;
        display:grid;
        place-items:center;
        flex:0 0 29px;
        color:var(--rfid-primary);
        background:#fff;
        border-radius:7px;
      }

      .rfid-campaign-link > div{
        min-width:0;
        flex:1;
        display:grid;
        gap:0;
      }

      .rfid-campaign-link strong,
      .rfid-campaign-link small{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .rfid-campaign-link strong{
        color:var(--rfid-text);
        font-size:8px;
        line-height:12px;
      }

      .rfid-campaign-link small{
        color:var(--rfid-muted);
        font-size:6px;
        line-height:10px;
      }

      .rfid-campaign-link > svg{
        color:var(--rfid-muted);
      }

      .rfid-detail-list{
        display:grid;
        gap:7px;
        margin:0;
      }

      .rfid-detail-list > div{
        display:grid;
        grid-template-columns:76px minmax(0,1fr);
        gap:9px;
      }

      .rfid-detail-list dt{
        color:var(--rfid-muted);
        font-size:7px;
        line-height:11px;
      }

      .rfid-detail-list dd{
        margin:0;
        overflow:hidden;
        color:var(--rfid-text);
        text-align:right;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:7px;
        font-weight:600;
        line-height:11px;
      }

      .rfid-workspace-links{
        display:grid;
        gap:4px;
      }

      .rfid-workspace-links a{
        min-height:32px;
        display:flex;
        align-items:center;
        gap:7px;
        padding:6px 7px;
        color:var(--rfid-text-soft)!important;
        border-radius:7px;
        text-decoration:none;
        font-size:8px;
        font-weight:600;
      }

      .rfid-workspace-links a:hover{
        color:var(--rfid-primary)!important;
        background:var(--rfid-primary-soft);
      }

      .rfid-fatal{
        max-width:620px;
        padding:28px;
        margin-top:18px;
        background:#fff;
        border:1px solid var(--rfid-outline);
        border-radius:15px;
      }

      .rfid-fatal-icon{
        width:46px;
        height:46px;
        display:grid;
        place-items:center;
        margin-bottom:13px;
        color:var(--rfid-primary);
        background:var(--rfid-primary-soft);
        border-radius:13px;
      }

      .rfid-fatal p{
        margin:7px 0 0;
        color:var(--rfid-text-soft);
        font-size:10px;
        line-height:16px;
      }

      .rfid-fatal-actions{
        display:flex;
        gap:7px;
        margin-top:17px;
      }

      .rfid-skeleton-top i,
      .rfid-skeleton-layout i{
        display:block;
        background:linear-gradient(90deg,#e9ebed 25%,#f8f9fa 45%,#e9ebed 65%);
        background-size:220% 100%;
        border-radius:999px;
        animation:rfidShimmer 1.25s linear infinite;
      }

      .rfid-skeleton-top{
        min-height:52px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        margin-bottom:10px;
      }

      .rfid-skeleton-top > i{
        width:100px;
        height:11px;
      }

      .rfid-skeleton-top > span{
        display:flex;
        gap:7px;
      }

      .rfid-skeleton-top > span i{
        width:85px;
        height:36px;
        border-radius:8px;
      }

      .rfid-skeleton-top > span i:last-child{
        width:36px;
      }

      .rfid-skeleton-layout{
        display:grid;
        grid-template-columns:minmax(0,1fr) 300px;
        gap:20px;
      }

      .rfid-skeleton-layout main{
        display:grid;
        gap:14px;
      }

      .rfid-skeleton-header{
        min-height:110px;
        display:flex;
        gap:12px;
        padding:22px;
        background:#fff;
        border:1px solid var(--rfid-outline);
        border-radius:14px;
      }

      .rfid-skeleton-header i.avatar{
        width:46px;
        height:46px;
        flex:0 0 46px;
        border-radius:50%;
      }

      .rfid-skeleton-header > span{
        flex:1;
        display:grid;
        align-content:start;
        gap:8px;
      }

      .rfid-skeleton-header > span i{
        width:110px;
        height:9px;
      }

      .rfid-skeleton-header > span i.title{
        width:52%;
        height:25px;
        border-radius:7px;
      }

      .rfid-skeleton-meta{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:10px;
      }

      .rfid-skeleton-meta i{
        height:62px;
        border-radius:10px;
      }

      .rfid-skeleton-insight{
        height:84px;
        border-radius:10px!important;
      }

      .rfid-skeleton-body{
        height:430px;
        border-radius:14px!important;
      }

      .rfid-skeleton-layout aside{
        display:grid;
        align-content:start;
        gap:1px;
        overflow:hidden;
        background:#fff;
        border:1px solid var(--rfid-outline);
        border-radius:14px;
      }

      .rfid-skeleton-layout aside i{
        height:86px;
        border-radius:0;
      }

      .rfid-skeleton-layout aside i.profile{
        height:190px;
      }

      @media(max-width:1120px){
        .rf-inbox-detail-v7{
          padding:20px 22px 38px;
        }

        .rfid-layout,
        .rfid-skeleton-layout{
          grid-template-columns:minmax(0,1fr) 270px;
          gap:14px;
        }

        .rfid-meta-grid{
          grid-template-columns:repeat(2,minmax(0,1fr));
        }
      }

      @media(max-width:880px){
        .rfid-layout,
        .rfid-skeleton-layout{
          grid-template-columns:1fr;
        }

        .rfid-sidebar{
          display:grid;
          grid-template-columns:repeat(2,minmax(0,1fr));
        }

        .rfid-profile-card{
          grid-row:span 2;
        }

        .rfid-sidebar-section{
          border-left:1px solid var(--rfid-outline);
        }

        .rfid-skeleton-layout aside{
          display:none;
        }
      }

      @media(max-width:650px){
        .rf-inbox-detail-v7{
          padding:15px 12px 84px;
        }

        .rfid-topbar{
          align-items:flex-start;
        }

        .rfid-message-header{
          flex-direction:column;
          padding:17px;
        }

        .rfid-message-heading h1,
        .rfid-fatal h1{
          font-size:20px;
          line-height:27px;
        }

        .rfid-statuses{
          justify-content:flex-start;
        }

        .rfid-meta-grid{
          grid-template-columns:1fr;
          gap:7px;
        }

        .rfid-email-body{
          padding:22px 18px;
        }

        .rfid-reply-card{
          align-items:stretch;
          flex-direction:column;
        }

        .rfid-reply-actions{
          width:100%;
        }

        .rfid-reply-actions .rfid-btn{
          flex:1;
        }

        .rfid-sidebar{
          display:block;
        }

        .rfid-profile-card{
          grid-row:auto;
        }

        .rfid-sidebar-section{
          border-left:0;
        }

        .rfid-fatal-actions{
          flex-direction:column;
        }

        .rfid-fatal-actions .rfid-btn{
          width:100%;
        }

        .rfid-skeleton-meta{
          grid-template-columns:1fr 1fr;
        }
      }

      @media(max-width:430px){
        .rfid-top-actions .rfid-btn{
          width:37px;
          padding:0;
          font-size:0;
        }

        .rfid-email-greeting,
        .rfid-email-paragraph,
        .rfid-email-bullets li,
        .rfid-email-signature p{
          font-size:10px;
          line-height:1.68;
        }

        .rfid-reply-actions{
          flex-direction:column;
        }

        .rfid-skeleton-meta{
          grid-template-columns:1fr;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-inbox-detail-v7,
        .rfid-message-header,
        .rfid-insight,
        .rfid-message,
        .rfid-skeleton-top i,
        .rfid-skeleton-layout i,
        .rf-inbox-detail-v7 .spin{
          animation:none!important;
        }

        .rf-inbox-detail-v7 *,
        .rf-inbox-detail-v7 *::before,
        .rf-inbox-detail-v7 *::after{
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
