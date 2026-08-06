import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  api,
} from "../api";

import "../styles.css";

const BUCKETS = [
  {
    value:
      "current",
    label:
      "Current tasks",
  },
  {
    value:
      "due",
    label:
      "Due now",
  },
  {
    value:
      "follow_ups",
    label:
      "Follow-ups",
  },
  {
    value:
      "missed",
    label:
      "Missed leads",
  },
  {
    value:
      "completed",
    label:
      "Completed",
  },
  {
    value:
      "all",
    label:
      "All leads",
  },
];

const OUTCOMES = [
  [
    "qualified",
    "Qualified",
  ],
  [
    "meeting_booked",
    "Meeting booked",
  ],
  [
    "callback",
    "Callback",
  ],
  [
    "follow_up",
    "Follow-up",
  ],
  [
    "no_answer",
    "No answer",
  ],
  [
    "busy",
    "Busy",
  ],
  [
    "voicemail",
    "Voicemail",
  ],
  [
    "not_interested",
    "Not interested",
  ],
  [
    "invalid_number",
    "Invalid number",
  ],
  [
    "do_not_call",
    "Do not call",
  ],
];

export default function MyLeadsPage() {
  const navigate =
    useNavigate();

  const [
    bucket,
    setBucket,
  ] = useState(
    "current"
  );

  const [
    records,
    setRecords,
  ] = useState([]);

  const [
    counts,
    setCounts,
  ] = useState({});

  const [
    selected,
    setSelected,
  ] = useState(null);

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    outcome,
    setOutcome,
  ] = useState(
    "qualified"
  );

  const [
    notes,
    setNotes,
  ] = useState("");

  const [
    callbackAt,
    setCallbackAt,
  ] = useState("");

  const request =
    useCallback(
      async (
        path,
        options = {}
      ) => {
        const token =
          api.getToken();

        const response =
          await fetch(
            `${getApiBaseUrl()}${path}`,
            {
              method:
                options.method ||
                "GET",

              headers: {
                Accept:
                  "application/json",

                ...(options.body
                  ? {
                      "Content-Type":
                        "application/json",
                    }
                  : {}),

                ...(token
                  ? {
                      Authorization:
                        `Bearer ${token}`,
                    }
                  : {}),
              },

              ...(options.body
                ? {
                    body:
                      JSON.stringify(
                        options.body
                      ),
                  }
                : {}),
            }
          );

        const data =
          await response
            .json()
            .catch(
              () => null
            );

        if (!response.ok) {
          throw new Error(
            data?.error ||
            data?.message ||
            `Request failed with status ${response.status}.`
          );
        }

        return data;
      },
      []
    );

  const load =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (!silent) {
          setLoading(true);
        }

        setError("");

        try {
          const response =
            await request(
              `/caller-queue?bucket=${encodeURIComponent(
                bucket
              )}&limit=1000`
            );

          setRecords(
            Array.isArray(
              response.records
            )
              ? response.records
              : []
          );

          setCounts(
            response.counts ||
            {}
          );

          setSelected(
            (current) => {
              if (!current) {
                return null;
              }

              return (
                response.records?.find(
                  (item) =>
                    item.id ===
                    current.id
                ) ||
                null
              );
            }
          );
        } catch (
          requestError
        ) {
          setError(
            requestError?.message ||
            "The caller queue could not be loaded."
          );
        } finally {
          if (!silent) {
            setLoading(false);
          }
        }
      },
      [
        bucket,
        request,
      ]
    );

  useEffect(() => {
    void load();

    const timer =
      window.setInterval(
        () =>
          void load({
            silent:
              true,
          }),
        15000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [
    load,
  ]);

  const filtered =
    useMemo(
      () => {
        const value =
          search
            .trim()
            .toLowerCase();

        if (!value) {
          return records;
        }

        return records.filter(
          (assignment) => {
            const lead =
              assignment.lead ||
              {};

            return [
              lead.business,
              lead.name,
              lead.phone,
              lead.email,
              lead.website,
              lead.address,
              assignment.campaignName,
            ]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(
                value
              );
          }
        );
      },
      [
        records,
        search,
      ]
    );

  async function openLead(
    assignment
  ) {
    setSelected(
      assignment
    );

    setNotes(
      assignment.notes ||
      ""
    );

    setOutcome(
      "qualified"
    );

    setCallbackAt(
      ""
    );

    try {
      const response =
        await request(
          `/caller-queue/${encodeURIComponent(
            assignment.id
          )}/open`,
          {
            method:
              "POST",
          }
        );

      replaceAssignment(
        response.assignment
      );
    } catch {
      // Opening the drawer should remain usable even if telemetry fails.
    }
  }

  async function callLead(
    assignment
  ) {
    const lead = assignment.lead || {};

    if (!lead.phone) {
      setError(
        "This lead does not have a phone number."
      );
      return;
    }

    setError("");

    navigate(
      `/app/call-workspace?assignmentId=${encodeURIComponent(
        assignment.id
      )}&leadId=${encodeURIComponent(
        assignment.leadId || lead.id || ""
      )}`
    );
  }

  async function saveOutcome() {
    if (!selected) {
      return;
    }

    const requiresDate =
      [
        "callback",
        "follow_up",
      ].includes(
        outcome
      );

    if (
      requiresDate &&
      !callbackAt
    ) {
      setError(
        "Select the callback or follow-up date and time."
      );

      return;
    }

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      const body = {
        outcome,
        notes,
        ...(outcome ===
          "callback"
          ? {
              callbackAt:
                new Date(
                  callbackAt
                ).toISOString(),
            }
          : {}),
        ...(outcome ===
          "follow_up"
          ? {
              followUpAt:
                new Date(
                  callbackAt
                ).toISOString(),
            }
          : {}),
      };

      const response =
        await request(
          `/caller-queue/${encodeURIComponent(
            selected.id
          )}/call/complete`,
          {
            method:
              "POST",
            body,
          }
        );

      setSuccess(
        `Outcome saved: ${formatLabel(
          outcome
        )}.`
      );

      const completed =
        response.assignment;

      setRecords(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              completed.id
          )
      );

      setSelected(
        null
      );

      await load({
        silent:
          true,
      });

      await openNextLead();
    } catch (
      requestError
    ) {
      setError(
        requestError?.message ||
        "The call outcome could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  async function skipSelected() {
    if (!selected) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await request(
        `/caller-queue/${encodeURIComponent(
          selected.id
        )}/skip`,
        {
          method:
            "POST",
          body: {
            delayMinutes:
              60,
            reason:
              "Skipped by caller",
          },
        }
      );

      setRecords(
        (current) =>
          current.filter(
            (item) =>
              item.id !==
              selected.id
          )
      );

      setSelected(
        null
      );

      await load({
        silent:
          true,
      });

      await openNextLead();
    } catch (
      requestError
    ) {
      setError(
        requestError?.message ||
        "The lead could not be skipped."
      );
    } finally {
      setSaving(false);
    }
  }

  async function openNextLead() {
    try {
      const response =
        await request(
          `/caller-queue/next?bucket=${encodeURIComponent(
            bucket
          )}`
        );

      if (
        response.assignment
      ) {
        await openLead(
          response.assignment
        );
      }
    } catch {
      // No eligible lead is a normal queue state.
    }
  }

  function replaceAssignment(
    updated
  ) {
    if (!updated) {
      return;
    }

    setRecords(
      (current) =>
        current.map(
          (item) =>
            item.id ===
              updated.id
              ? updated
              : item
        )
    );

    setSelected(
      (current) =>
        current?.id ===
          updated.id
          ? updated
          : current
    );
  }

  return (
    <main className="caller-queue-page">
      <header className="caller-queue-heading">
        <div>
          <span className="eyebrow">
            Caller workspace
          </span>

          <h1>
            My lead queue
          </h1>

          <p>
            Work the next eligible lead, record the outcome, and let ReachFly schedule every retry automatically.
          </p>
        </div>

        <div className="caller-queue-heading__actions">
          <button
            type="button"
            className="btn light"
            onClick={() =>
              void load()
            }
          >
            Refresh
          </button>

          <button
            type="button"
            className="btn primary"
            onClick={() =>
              void openNextLead()
            }
          >
            Call next lead
          </button>
        </div>
      </header>

      {error ? (
        <div className="error-banner">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="success-banner">
          {success}
        </div>
      ) : null}

      <nav className="caller-queue-tabs">
        {BUCKETS.map(
          (item) => (
            <button
              key={
                item.value
              }
              type="button"
              className={
                bucket ===
                item.value
                  ? "active"
                  : ""
              }
              onClick={() => {
                setBucket(
                  item.value
                );
                setSelected(
                  null
                );
              }}
            >
              <span>
                {item.label}
              </span>

              <b>
                {counts[
                  item.value
                ] || 0}
              </b>
            </button>
          )
        )}
      </nav>

      <div className="caller-queue-toolbar">
        <input
          value={
            search
          }
          onChange={(
            event
          ) =>
            setSearch(
              event.target
                .value
            )
          }
          placeholder="Search business, phone, email, website or campaign"
        />

        <span>
          {filtered.length} displayed
        </span>
      </div>

      {loading ? (
        <div className="caller-queue-loading">
          Loading caller queue…
        </div>
      ) : filtered.length ? (
        <section className="caller-queue-grid">
          {filtered.map(
            (assignment) => (
              <LeadCard
                key={
                  assignment.id
                }
                assignment={
                  assignment
                }
                onOpen={() =>
                  void openLead(
                    assignment
                  )
                }
                onCall={() =>
                  void callLead(
                    assignment
                  )
                }
              />
            )
          )}
        </section>
      ) : (
        <section className="caller-queue-empty">
          <strong>
            No leads in this queue
          </strong>

          <p>
            Due missed leads and follow-ups will return automatically at their scheduled time.
          </p>
        </section>
      )}

      {selected ? (
        <div
          className="caller-workspace-backdrop"
          onClick={() =>
            setSelected(
              null
            )
          }
        >
          <section
            className="caller-workspace"
            onClick={(
              event
            ) =>
              event.stopPropagation()
            }
          >
            <header>
              <div>
                <span className="eyebrow">
                  Active lead
                </span>

                <h2>
                  {getLeadName(
                    selected
                  )}
                </h2>

                <p>
                  {selected.lead
                    ?.phone ||
                    "No phone number"}
                </p>
              </div>

              <button
                type="button"
                className="caller-workspace__close"
                onClick={() =>
                  setSelected(
                    null
                  )
                }
              >
                ×
              </button>
            </header>

            <div className="caller-workspace__layout">
              <div className="caller-workspace__main">
                <LeadSummary
                  assignment={
                    selected
                  }
                />

                <button
                  type="button"
                  className="btn primary full"
                  disabled={
                    saving ||
                    !selected.lead
                      ?.phone
                  }
                  onClick={() =>
                    void callLead(
                      selected
                    )
                  }
                >
                  Call lead
                </button>

                <label>
                  <span>
                    Call outcome
                  </span>

                  <select
                    value={
                      outcome
                    }
                    onChange={(
                      event
                    ) =>
                      setOutcome(
                        event.target
                          .value
                      )
                    }
                  >
                    {OUTCOMES.map(
                      ([
                        value,
                        label,
                      ]) => (
                        <option
                          key={
                            value
                          }
                          value={
                            value
                          }
                        >
                          {label}
                        </option>
                      )
                    )}
                  </select>
                </label>

                {[
                  "callback",
                  "follow_up",
                ].includes(
                  outcome
                ) ? (
                  <label>
                    <span>
                      Next call date and time
                    </span>

                    <input
                      type="datetime-local"
                      value={
                        callbackAt
                      }
                      onChange={(
                        event
                      ) =>
                        setCallbackAt(
                          event.target
                            .value
                        )
                      }
                    />
                  </label>
                ) : null}

                <label>
                  <span>
                    Notes
                  </span>

                  <textarea
                    value={
                      notes
                    }
                    onChange={(
                      event
                    ) =>
                      setNotes(
                        event.target
                          .value
                      )
                    }
                    placeholder="Decision maker, objections, agreed next action and useful context"
                  />
                </label>

                <div className="caller-workspace__buttons">
                  <button
                    type="button"
                    className="btn light"
                    disabled={
                      saving
                    }
                    onClick={() =>
                      void skipSelected()
                    }
                  >
                    Skip for one hour
                  </button>

                  <button
                    type="button"
                    className="btn primary"
                    disabled={
                      saving
                    }
                    onClick={() =>
                      void saveOutcome()
                    }
                  >
                    {saving
                      ? "Saving…"
                      : "Save and open next"}
                  </button>
                </div>
              </div>

              <aside className="caller-workspace__audit">
                <span className="eyebrow">
                  Mini audit
                </span>

                {selected.miniAudit ||
                selected.lead
                  ?.miniAudit ? (
                  <MiniAudit
                    audit={
                      selected.miniAudit ||
                      selected.lead
                        .miniAudit
                    }
                  />
                ) : (
                  <div className="caller-audit-pending">
                    <strong>
                      Audit is being prepared
                    </strong>

                    <p>
                      Daily automation queues mini audits for website leads before outreach.
                    </p>
                  </div>
                )}
              </aside>
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}

function LeadCard({
  assignment,
  onOpen,
  onCall,
}) {
  const lead =
    assignment.lead ||
    {};

  return (
    <article className="caller-lead-card">
      <header>
        <div className="caller-lead-card__avatar">
          {initials(
            getLeadName(
              assignment
            )
          )}
        </div>

        <span className={`status status-${assignment.status}`}>
          {formatLabel(
            assignment.status
          )}
        </span>
      </header>

      <h3>
        {getLeadName(
          assignment
        )}
      </h3>

      <p>
        {lead.category ||
          assignment.campaignName ||
          "Assigned lead"}
      </p>

      <dl>
        <div>
          <dt>
            Phone
          </dt>
          <dd>
            {lead.phone ||
              "Unavailable"}
          </dd>
        </div>

        <div>
          <dt>
            Website
          </dt>
          <dd>
            {lead.website ||
              "Unavailable"}
          </dd>
        </div>

        <div>
          <dt>
            Attempts
          </dt>
          <dd>
            {assignment.callAttempts ||
              0}
          </dd>
        </div>

        <div>
          <dt>
            Next action
          </dt>
          <dd>
            {formatDateTime(
              assignment.nextActionAt
            )}
          </dd>
        </div>
      </dl>

      <footer>
        <button
          type="button"
          className="btn light"
          onClick={
            onOpen
          }
        >
          Open
        </button>

        <button
          type="button"
          className="btn primary"
          disabled={
            !lead.phone
          }
          onClick={
            onCall
          }
        >
          Call
        </button>
      </footer>
    </article>
  );
}

function LeadSummary({
  assignment,
}) {
  const lead =
    assignment.lead ||
    {};

  return (
    <section className="caller-lead-summary">
      <div>
        <small>
          Phone
        </small>
        <strong>
          {lead.phone ||
            "Unavailable"}
        </strong>
      </div>

      <div>
        <small>
          Email
        </small>
        <strong>
          {lead.email ||
            "Unavailable"}
        </strong>
      </div>

      <div>
        <small>
          Website
        </small>
        <strong>
          {lead.website ||
            "Unavailable"}
        </strong>
      </div>

      <div>
        <small>
          Location
        </small>
        <strong>
          {lead.address ||
            lead.location ||
            "Unavailable"}
        </strong>
      </div>
    </section>
  );
}

function MiniAudit({
  audit,
}) {
  const findings =
    Array.isArray(
      audit.findings
    )
      ? audit.findings
      : Array.isArray(
            audit.issues
          )
        ? audit.issues
        : [];

  return (
    <div className="caller-mini-audit">
      {audit.summary ? (
        <p>
          {audit.summary}
        </p>
      ) : null}

      {findings
        .slice(
          0,
          5
        )
        .map(
          (
            finding,
            index
          ) => (
            <article
              key={
                finding.id ||
                index
              }
            >
              <strong>
                {finding.title ||
                  finding.issue ||
                  `Finding ${
                    index + 1
                  }`}
              </strong>

              <p>
                {finding.description ||
                  finding.evidence ||
                  finding.impact ||
                  ""}
              </p>
            </article>
          )
        )}
    </div>
  );
}

function getLeadName(
  assignment
) {
  return (
    assignment.lead
      ?.business ||
    assignment.lead
      ?.name ||
    "Unnamed lead"
  );
}

function initials(
  value
) {
  return String(
    value ||
      "RF"
  )
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(
      (part) =>
        part[0]
    )
    .join("")
    .toUpperCase();
}

function formatLabel(
  value
) {
  return String(
    value ||
      ""
  )
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function formatDateTime(
  value
) {
  if (!value) {
    return "Ready now";
  }

  const date =
    new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? "—"
    : date.toLocaleString(
        undefined,
        {
          month:
            "short",
          day:
            "numeric",
          hour:
            "numeric",
          minute:
            "2-digit",
        }
      );
}

function getApiBaseUrl() {
  const configured =
    String(
      import.meta.env
        .VITE_API_URL ||
        ""
    )
      .trim()
      .replace(
        /\/+$/,
        ""
      );

  if (configured) {
    return /\/api$/i.test(
      configured
    )
      ? configured
      : `${configured}/api`;
  }

  return `${window.location.protocol}//${window.location.hostname}:8787/api`;
}
