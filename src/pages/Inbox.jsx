import { Link } from "react-router-dom";
import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api";
import {
  Inbox as InboxIcon,
  Mail,
  MessageCircle,
  Search,
  Send,
} from "../components/icons";
import EmptyState from "../components/EmptyState";

const tabs = [
  { key: "all", label: "All activity" },
  { key: "replies", label: "Replies" },
  { key: "sent", label: "Sent" },
  { key: "unread", label: "Unread replies" },
];

export default function Inbox() {
  const [items, setItems] = useState([]);
  const [activeTab, setActiveTab] = useState("all");
  const [campaignId, setCampaignId] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refreshActivity = useCallback(async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setError("");

      const syncResult = await api.syncInbox(50);

      if (syncResult?.ok && Array.isArray(syncResult.items)) {
        setItems(syncResult.items);
        return;
      }

      const inboxResult = await api.inbox();
      setItems(Array.isArray(inboxResult) ? inboxResult : []);

      if (syncResult && syncResult.ok === false && !silent) {
        setError(syncResult.message || "Automatic inbox sync failed.");
      }
    } catch (e) {
      try {
        const inboxResult = await api.inbox();
        setItems(Array.isArray(inboxResult) ? inboxResult : []);
      } catch {
        setError(e.message || "Could not load campaign email activity.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let running = false;

    const run = async (silent = false) => {
      if (!active || running) return;

      running = true;

      try {
        await refreshActivity({ silent });
      } finally {
        running = false;
      }
    };

    run(false);

    const timer = setInterval(() => {
      run(true);
    }, 8000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [refreshActivity]);

  const campaignActivity = useMemo(() => {
    const map = new Map();

    for (const item of items) {
      const id = item.campaignId || "uncategorized";
      const name = item.campaignName || "Uncategorized campaign";
      const current = map.get(id) || {
        id,
        name,
        sent: 0,
        replies: 0,
        unread: 0,
        latestAt: item.createdAt || "",
      };

      if (isSent(item)) current.sent += 1;
      if (isReply(item)) current.replies += 1;
      if (isReply(item) && item.unread) current.unread += 1;

      if (
        new Date(item.createdAt || 0).getTime() >
        new Date(current.latestAt || 0).getTime()
      ) {
        current.latestAt = item.createdAt;
      }

      map.set(id, current);
    }

    return Array.from(map.values()).sort(
      (a, b) =>
        new Date(b.latestAt || 0).getTime() -
        new Date(a.latestAt || 0).getTime()
    );
  }, [items]);

  const filteredItems = useMemo(() => {
    const search = query.trim().toLowerCase();

    return items.filter((msg) => {
      if (activeTab === "sent" && !isSent(msg)) return false;
      if (activeTab === "replies" && !isReply(msg)) return false;
      if (activeTab === "unread" && (!isReply(msg) || !msg.unread)) {
        return false;
      }

      if (
        campaignId !== "all" &&
        (msg.campaignId || "uncategorized") !== campaignId
      ) {
        return false;
      }

      if (!search) return true;

      const haystack = [
        msg.subject,
        msg.title,
        msg.fromName,
        msg.fromEmail,
        msg.toEmail,
        msg.campaignName,
        msg.leadName,
        msg.snippet,
        msg.body,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(search);
    });
  }, [items, activeTab, campaignId, query]);

  const stats = useMemo(() => {
    const sent = items.filter(isSent).length;
    const replies = items.filter(isReply).length;
    const unread = items.filter((msg) => isReply(msg) && msg.unread).length;

    return {
      total: sent + replies,
      sent,
      replies,
      unread,
      replyRate: sent ? Math.round((replies / sent) * 1000) / 10 : 0,
    };
  }, [items]);

  return (
    <div className="inbox-page rf-inbox-page">
      <div className="rf-inbox-hero">
        <div>
          <span className="eyebrow">Campaign email activity</span>
          <h1>Sent emails and their replies.</h1>
          <p>
            Only replies connected to emails sent from your campaigns appear
            here. Unrelated personal mailbox emails are excluded.
          </p>
        </div>

        <div className="rf-inbox-actions">
          <Link className="btn primary" to="/app/email">
            <Send size={15} /> Send email
          </Link>
        </div>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <section className="rf-inbox-stats">
        <StatCard label="Total activity" value={stats.total} />
        <StatCard label="Emails sent" value={stats.sent} />
        <StatCard label="Replies received" value={stats.replies} />
        <StatCard
          label="Reply rate"
          value={`${stats.replyRate}%`}
          note={`${stats.unread} unread`}
        />
      </section>

      {campaignActivity.length ? (
        <section className="rf-campaign-email-activity">
          <div className="rf-section-heading">
            <div>
              <span className="eyebrow">By campaign</span>
              <h2>Email activity</h2>
            </div>
          </div>

          <div className="rf-campaign-email-grid">
            {campaignActivity.map((campaign) => (
              <button
                key={campaign.id}
                type="button"
                className={`rf-campaign-email-card ${
                  campaignId === campaign.id ? "active" : ""
                }`}
                onClick={() =>
                  setCampaignId((current) =>
                    current === campaign.id ? "all" : campaign.id
                  )
                }
              >
                <strong>{campaign.name}</strong>
                <span>{campaign.sent} sent</span>
                <span>{campaign.replies} replies</span>
                {campaign.unread ? <em>{campaign.unread} unread</em> : null}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section className="rf-inbox-toolbar">
        <div className="rf-inbox-tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={activeTab === tab.key ? "active" : ""}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="rf-inbox-toolbar-right">
          <select
            className="rf-inbox-campaign-select"
            value={campaignId}
            onChange={(event) => setCampaignId(event.target.value)}
            aria-label="Filter by campaign"
          >
            <option value="all">All campaigns</option>
            {campaignActivity.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>
                {campaign.name}
              </option>
            ))}
          </select>

          <label className="rf-inbox-search">
            <Search size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search subject, lead, campaign…"
            />
          </label>
        </div>
      </section>

      {loading ? (
        <div className="skeleton-list">
          <i />
          <i />
          <i />
        </div>
      ) : filteredItems.length === 0 ? (
        <EmptyState
          title={items.length ? "No matching email activity" : "No campaign email activity yet"}
          text={
            items.length
              ? "Try another search, campaign, or activity filter."
              : "Send campaign emails first. Replies will appear here automatically."
          }
          to="/app/email"
          action="Send email"
        />
      ) : (
        <div className="rf-inbox-list">
          {filteredItems.map((msg) => (
            <EmailCard key={msg.id} msg={msg} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmailCard({ msg }) {
  const sent = isSent(msg);
  const whatsapp = msg.channel === "whatsapp";
  const title = msg.subject || msg.title || "No subject";

  const senderName = sent
    ? msg.leadName || msg.toName || msg.toEmail || "Recipient"
    : msg.fromName || msg.leadName || "Unknown sender";

  const senderEmail = sent ? msg.toEmail || "" : msg.fromEmail || "";
  const preview = normalizePreview(msg.snippet || msg.body || "No preview available.");

  return (
    <Link
      className={`rf-inbox-card ${msg.unread ? "unread" : ""} ${
        sent ? "sent" : "reply"
      }`}
      to={`/app/inbox/${encodeURIComponent(msg.id)}`}
      state={{ message: msg }}
    >
      <div className="rf-inbox-card-media">
        <span className="rf-inbox-card-icon">
          {whatsapp ? (
            <MessageCircle size={20} />
          ) : sent ? (
            <Send size={20} />
          ) : (
            <Mail size={20} />
          )}
        </span>

        {!sent && msg.unread ? <i className="rf-inbox-unread-dot" /> : null}
      </div>

      <div className="rf-inbox-card-content">
        <div className="rf-inbox-card-head">
          <div className="rf-inbox-card-title">
            <h3>{title}</h3>

            <div className="rf-inbox-sender-line">
              <b>{sent ? `To: ${senderName}` : senderName}</b>
              {senderEmail ? <span>{senderEmail}</span> : null}
            </div>
          </div>

          <time>{formatDate(msg.createdAt)}</time>
        </div>

        <p className="rf-inbox-preview">{preview}</p>

        <div className="rf-inbox-card-foot">
          <span className="rf-inbox-source">
            <InboxIcon size={13} />
            {msg.campaignName || "Campaign"}
          </span>

          <div className="rf-inbox-tags">
            <em>{sent ? "SENT" : "REPLY"}</em>
            {msg.provider ? <em>{String(msg.provider).toUpperCase()}</em> : null}
            {!sent && msg.unread ? <em>UNREAD</em> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

function StatCard({ label, value, note = "" }) {
  return (
    <article className="rf-inbox-stat-card">
      <span>{label}</span>
      <b>{value}</b>
      {note ? <small>{note}</small> : null}
    </article>
  );
}

function isSent(msg) {
  return msg.direction === "outbound" && msg.channel === "email";
}

function isReply(msg) {
  return (
    msg.direction === "inbound" &&
    msg.channel === "email" &&
    Boolean(msg.replyToSentId)
  );
}

function normalizePreview(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

function formatDate(value) {
  if (!value) return "Unknown time";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown time";

  return date.toLocaleString();
}