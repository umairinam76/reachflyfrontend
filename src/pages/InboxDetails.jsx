import { Link, useLocation, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { api } from "../api";
import {
  ArrowLeft,
  Calendar,
  Inbox as InboxIcon,
  Mail,
  MessageCircle,
  UserRound,
} from "../components/icons";
import EmptyState from "../components/EmptyState";

export default function InboxDetail() {
  const { messageId } = useParams();
  const location = useLocation();

  const decodedId = useMemo(() => {
    try {
      return decodeURIComponent(messageId || "");
    } catch {
      return messageId || "";
    }
  }, [messageId]);

  const [message, setMessage] = useState(location.state?.message || null);
  const [loading, setLoading] = useState(!location.state?.message);
  const [error, setError] = useState("");

  useEffect(() => {
    if (message?.id === decodedId) return;

    let alive = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const result = await api.inbox();
        const found = Array.isArray(result)
          ? result.find((item) => item.id === decodedId)
          : null;

        if (alive) setMessage(found || null);
      } catch (e) {
        if (alive) setError(e.message || "Could not load email.");
      } finally {
        if (alive) setLoading(false);
      }
    };

    load();

    return () => {
      alive = false;
    };
  }, [decodedId, message?.id]);

  if (loading) {
    return (
      <div className="page rf-inbox-detail-page">
        <div className="skeleton-list">
          <i />
          <i />
          <i />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page rf-inbox-detail-page">
        <p className="error-banner">{error}</p>
      </div>
    );
  }

  if (!message) {
    return (
      <div className="page rf-inbox-detail-page">
        <EmptyState
          title="Email not found"
          text="This email may no longer exist in the synced inbox."
          to="/app/inbox"
          action="Back to inbox"
        />
      </div>
    );
  }

  const isMailbox = message.source === "mailbox";
  const isWhatsApp = message.channel === "whatsapp";
  const title = message.subject || message.title || "No subject";
  const senderName = isMailbox
    ? message.fromName || "Unknown sender"
    : message.campaignName || "Campaign";
  const senderEmail = isMailbox ? message.fromEmail || "" : message.leadName || "";
  const body = message.body || message.snippet || "No email body available.";

  return (
    <div className="page rf-inbox-detail-page">
      <div className="rf-inbox-detail-topbar">
        <Link to="/app/inbox" className="btn ghost small">
          <ArrowLeft size={14} /> Back to inbox
        </Link>

        <div className="rf-inbox-detail-status">
          {message.provider ? <em>{String(message.provider).toUpperCase()}</em> : null}
          {message.unread ? <em>UNREAD</em> : null}
          <em>{isMailbox ? "MAILBOX" : "CAMPAIGN"}</em>
        </div>
      </div>

      <article className="rf-inbox-detail-card">
        <header className="rf-inbox-detail-header">
          <span className="rf-inbox-detail-icon">
            {isWhatsApp ? <MessageCircle size={26} /> : <Mail size={26} />}
          </span>

          <div>
            <span className="eyebrow">
              {isMailbox ? "Mailbox email" : "Campaign message"}
            </span>
            <h1>{title}</h1>
            <p>{senderName}</p>
          </div>
        </header>

        <section className="rf-inbox-detail-grid">
          <DetailItem
            icon={UserRound}
            label="From"
            value={`${senderName}${senderEmail ? ` · ${senderEmail}` : ""}`}
          />

          <DetailItem
            icon={InboxIcon}
            label="To"
            value={message.toEmail || "Not available"}
          />

          <DetailItem
            icon={Calendar}
            label="Received"
            value={formatDate(message.createdAt)}
          />

          <DetailItem
            icon={InboxIcon}
            label="Source"
            value={isMailbox ? "Connected mailbox" : message.campaignName || "Campaign"}
          />
        </section>

        <section className="rf-inbox-detail-body">
          <div className="rf-inbox-detail-body-head">
            <h2>Email content</h2>
          </div>

          <StructuredEmailBody value={body} />
        </section>
      </article>
    </div>
  );
}

function DetailItem({ icon: Icon, label, value }) {
  return (
    <div className="rf-inbox-detail-item">
      <span>
        <Icon size={16} />
      </span>

      <div>
        <small>{label}</small>
        <b>{value}</b>
      </div>
    </div>
  );
}

function StructuredEmailBody({ value }) {
  const blocks = useMemo(() => structureEmailBody(value), [value]);

  if (!blocks.length) {
    return <p className="rf-email-paragraph">No email body available.</p>;
  }

  return (
    <div className="rf-inbox-message-body structured">
      {blocks.map((block, index) => {
        if (block.type === "bullets") {
          return (
            <ul className="rf-email-bullets" key={index}>
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <LinkifiedText text={item} />
                </li>
              ))}
            </ul>
          );
        }

        if (block.type === "signature") {
          return (
            <div className="rf-email-signature" key={index}>
              {block.lines.map((line, lineIndex) => (
                <p key={lineIndex}>
                  <LinkifiedText text={line} />
                </p>
              ))}
            </div>
          );
        }

        if (block.type === "greeting") {
          return (
            <p className="rf-email-greeting" key={index}>
              <LinkifiedText text={block.text} />
            </p>
          );
        }

        return (
          <p className="rf-email-paragraph" key={index}>
            <LinkifiedText text={block.text} />
          </p>
        );
      })}
    </div>
  );
}

function structureEmailBody(value) {
  const prepared = prepareEmailText(value);

  if (!prepared) return [];

  const lines = prepared
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks = [];
  let bulletBuffer = [];
  let signatureBuffer = [];
  let inSignature = false;

  const flushBullets = () => {
    if (!bulletBuffer.length) return;

    blocks.push({
      type: "bullets",
      items: bulletBuffer,
    });

    bulletBuffer = [];
  };

  const flushSignature = () => {
    if (!signatureBuffer.length) return;

    blocks.push({
      type: "signature",
      lines: signatureBuffer,
    });

    signatureBuffer = [];
  };

  lines.forEach((line, index) => {
    const cleaned = line.replace(/^[-•*]\s*/, "").trim();
    const isBullet = /^[-•*]\s+/.test(line);
    const isFirstShortGreeting =
      index === 0 &&
      /^[a-z0-9\s.'-]{2,45},$/i.test(line) &&
      !line.includes("@");

    const startsSignature =
      /^(best regards|regards|kind regards|thanks|thank you|sincerely|cheers|warm regards|best,|regards,)/i.test(
        line
      );

    if (isBullet) {
      flushSignature();
      bulletBuffer.push(cleaned);
      return;
    }

    flushBullets();

    if (startsSignature) {
      inSignature = true;
      signatureBuffer.push(line);
      return;
    }

    if (inSignature) {
      signatureBuffer.push(line);
      return;
    }

    if (isFirstShortGreeting) {
      blocks.push({
        type: "greeting",
        text: line,
      });
      return;
    }

    blocks.push({
      type: "paragraph",
      text: line,
    });
  });

  flushBullets();
  flushSignature();

  return blocks;
}

function prepareEmailText(value) {
  let text = decodeEntities(String(value || ""))
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+•\s+/g, "\n• ")
    .replace(/\s+-\s+(?=[A-Za-z0-9])/g, "\n- ")
    .trim();

  if (!text.includes("\n")) {
    text = text
      .replace(/^([A-Za-z0-9\s.'-]{2,45},)\s+/, "$1\n\n")
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
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .join("\n")
    .trim();
}

function LinkifiedText({ text }) {
  const parts = String(text || "").split(
    /(https?:\/\/[^\s]+|www\.[^\s]+|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/gi
  );

  return (
    <>
      {parts.map((part, index) => {
        if (/^https?:\/\//i.test(part)) {
          return (
            <a key={index} href={part} target="_blank" rel="noreferrer">
              {part}
            </a>
          );
        }

        if (/^www\./i.test(part)) {
          return (
            <a key={index} href={`https://${part}`} target="_blank" rel="noreferrer">
              {part}
            </a>
          );
        }

        if (/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(part)) {
          return (
            <a key={index} href={`mailto:${part}`}>
              {part}
            </a>
          );
        }

        return part;
      })}
    </>
  );
}

function decodeEntities(value) {
  return String(value || "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function formatDate(value) {
  if (!value) return "Unknown time";

  try {
    return new Date(value).toLocaleString();
  } catch {
    return "Unknown time";
  }
}