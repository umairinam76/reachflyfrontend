import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  apiRequest,
  onWorkspaceSocket,
} from "../lib/workspace-platform-client.js";

const REPORTS = [
  {
    kind: "website",
    label: "Website / Technology Audit",
    eyebrow: "Required · Website calls",
    description:
      "Manager-approved format for Website campaign leads. Upload a PDF example; every generated audit still uses the current lead's own verified evidence.",
  },
  {
    kind: "gmb",
    label: "GMB / Local Visibility Audit",
    eyebrow: "Required · GMB calls",
    description:
      "Manager-approved format for GMB campaign leads. Upload a PDF example; every report is generated dynamically for that business and market.",
  },
  {
    kind: "mini",
    label: "Mini Audit",
    eyebrow: "Pre-call intelligence",
    description:
      "Fast, factual intelligence a caller can scan before dialing.",
  },
  {
    kind: "competitor",
    label: "Competitor Analysis",
    eyebrow: "Market intelligence",
    description:
      "Verified competitor and market-positioning analysis for the lead's local market.",
  },
  {
    kind: "full",
    label: "Full Audit",
    eyebrow: "Detailed opportunity analysis",
    description:
      "Evidence-grounded technical, SEO, conversion, trust, and roadmap analysis.",
  },
];

export default function AuditStudioPanel() {
  const [studio, setStudio] =
    useState(null);
  const [activeKind, setActiveKind] =
    useState("website");
  const [drafts, setDrafts] =
    useState({});
  const [systemPrompt, setSystemPrompt] =
    useState("");
  const [loading, setLoading] =
    useState(true);
  const [saving, setSaving] =
    useState(false);
  const [uploading, setUploading] =
    useState(false);
  const [restoring, setRestoring] =
    useState(0);
  const [error, setError] =
    useState("");
  const [message, setMessage] =
    useState("");
  const fileInputRef = useRef(null);

  const load = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true);
      setError("");

      try {
        const result =
          await apiRequest(
            "/audit-studio"
          );

        setStudio(result);
        setSystemPrompt(
          result?.managerSystemPrompt || ""
        );
        setDrafts(
          buildDrafts(result)
        );
      } catch (requestError) {
        setError(
          requestError?.message ||
            "Audit Studio could not be loaded."
        );
      } finally {
        if (!silent) setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const refresh = () =>
      void load({ silent: true });

    const subscriptions = [
      onWorkspaceSocket(
        "audit-studio:updated",
        refresh
      ),
      onWorkspaceSocket(
        "audit-studio:template-updated",
        refresh
      ),
    ];

    return () =>
      subscriptions.forEach(
        (unsubscribe) =>
          unsubscribe?.()
      );
  }, [load]);

  const activeDefinition =
    useMemo(
      () =>
        REPORTS.find(
          (item) =>
            item.kind === activeKind
        ) || REPORTS[0],
      [activeKind]
    );

  const activeTemplate =
    studio?.templates?.[
      activeKind
    ]?.active || null;

  const versions =
    studio?.templates?.[
      activeKind
    ]?.versions || [];

  const draft =
    drafts[activeKind] ||
    emptyDraft(activeDefinition);

  function setDraftField(key, value) {
    setDrafts((current) => ({
      ...current,
      [activeKind]: {
        ...(current[activeKind] ||
          emptyDraft(
            activeDefinition
          )),
        [key]: value,
      },
    }));
  }

  async function saveActiveTemplate() {
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await apiRequest(
        "/audit-studio/settings",
        {
          method: "PUT",
          body: {
            managerSystemPrompt:
              systemPrompt,
          },
        }
      );

      const result = await apiRequest(
        `/audit-studio/templates/${activeKind}`,
        {
          method: "PUT",
          body: {
            name: draft.name,
            enabled:
              draft.enabled !== false,
            lengthGuidance:
              draft.lengthGuidance,
            instructions:
              draft.instructions,
          },
        }
      );

      setMessage(
        `${activeDefinition.label} saved as version ${result?.template?.version ?? "new"}. New audits will use this format immediately.`
      );

      await load({ silent: true });
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Audit format could not be saved."
      );
    } finally {
      setSaving(false);
    }
  }

  async function uploadExample(file) {
    if (!file) return;

    if (
      file.type !== "application/pdf"
    ) {
      setError(
        "Please upload a PDF example report."
      );
      return;
    }

    if (
      file.size >
      15 * 1024 * 1024
    ) {
      setError(
        "Example PDF must be 15 MB or smaller."
      );
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");

    try {
      // Persist manager-wide Claude style guidance without creating a
      // duplicate report-template version. The multipart upload below creates
      // the one new version containing both the current fields and PDF.
      await apiRequest(
        "/audit-studio/settings",
        {
          method: "PUT",
          body: {
            managerSystemPrompt:
              systemPrompt || "",
          },
        }
      );

      const body = new FormData();
      body.append("file", file);
      body.append(
        "name",
        draft.name || ""
      );
      body.append(
        "enabled",
        String(draft.enabled !== false)
      );
      body.append(
        "lengthGuidance",
        draft.lengthGuidance || ""
      );
      body.append(
        "instructions",
        draft.instructions || ""
      );

      const result = await apiRequest(
        `/audit-studio/templates/${activeKind}/example`,
        {
          method: "POST",
          body,
          timeoutMs: 120_000,
        }
      );

      setMessage(
        `${activeDefinition.label} reference PDF uploaded as version ${result?.template?.version ?? "current"}. It will guide layout/style only; each new report remains dynamic to its lead.`
      );

      await load({ silent: true });
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Example PDF could not be uploaded."
      );
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  async function downloadExample() {
    setError("");

    try {
      const blob = await apiRequest(
        `/audit-studio/templates/${activeKind}/example`,
        {
          responseType: "blob",
          timeoutMs: 120_000,
        }
      );

      const url =
        URL.createObjectURL(blob);
      const anchor =
        document.createElement("a");
      anchor.href = url;
      anchor.download =
        activeTemplate?.examplePdf
          ?.originalName ||
        `${activeKind}-audit-example.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Reference PDF could not be opened."
      );
    }
  }

  async function restoreVersion(version) {
    setRestoring(version);
    setError("");
    setMessage("");

    try {
      const result = await apiRequest(
        `/audit-studio/templates/${activeKind}/restore/${version}`,
        {
          method: "POST",
        }
      );

      setMessage(
        `Version ${version} was restored as new active version ${result?.template?.version ?? "current"}.`
      );
      await load({ silent: true });
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Audit template version could not be restored."
      );
    } finally {
      setRestoring(0);
    }
  }

  if (loading) {
    return (
      <section className="rf-panel">
        <p>Loading Audit Studio…</p>
      </section>
    );
  }

  return (
    <section className="rf-panel">
      <div className="rf-panel-header">
        <div>
          <p className="rf-dashboard-eyebrow">
            Manager audit controls
          </p>
          <h2>Audit Studio</h2>
          <p>
            Control the required Website / Technology and GMB / Local Visibility caller-audit formats, plus Mini, Competitor, and Full reports. Upload one approved PDF example per type. PDFs control format/style only; every report is generated dynamically from the current lead's own verified public evidence.
          </p>
        </div>

        <div style={qualityBadgeStyle}>
          <span
            style={{
              fontSize: 11,
              opacity: 0.64,
            }}
          >
            Production guardrail
          </span>
          <strong>
            Verified evidence only
          </strong>
        </div>
      </div>

      <div style={requiredFormatNoteStyle}>
        <strong>Required daily-call formats:</strong>{" "}
        Website calls use the Website / Technology template and GMB calls use the GMB / Local Visibility template. Upload an approved PDF example for both before callers work those queues.
      </div>

      {error ? (
        <div className="rf-inline-alert">
          {error}
        </div>
      ) : null}

      {message ? (
        <div className="success-banner">
          {message}
        </div>
      ) : null}

      <div style={reportCardGridStyle}>
        {REPORTS.map((item) => {
          const template =
            studio?.templates?.[
              item.kind
            ]?.active;
          const selected =
            item.kind === activeKind;

          return (
            <button
              key={item.kind}
              type="button"
              onClick={() =>
                setActiveKind(item.kind)
              }
              style={{
                ...reportCardStyle,
                ...(selected
                  ? selectedReportCardStyle
                  : {}),
              }}
            >
              <span style={eyebrowStyle}>
                {item.eyebrow}
              </span>
              <strong
                style={{
                  fontSize: 16,
                }}
              >
                {item.label}
              </strong>
              <span style={cardDescriptionStyle}>
                {item.description}
              </span>
              <span style={cardFooterStyle}>
                <span>
                  {template?.enabled === false
                    ? "Disabled"
                    : "Enabled"}
                </span>
                <span>
                  v{template?.version ?? 0}
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <div style={studioGridStyle}>
        <div style={editorStyle}>
          <div style={editorHeaderStyle}>
            <div>
              <span style={eyebrowStyle}>
                {activeDefinition.eyebrow}
              </span>
              <h3
                style={{
                  margin: "4px 0 0",
                }}
              >
                {activeDefinition.label}
              </h3>
            </div>
            <span style={versionBadgeStyle}>
              Active v{activeTemplate?.version ?? 0}
            </span>
          </div>

          <div style={formGridStyle}>
            <Field label="Display name">
              <input
                value={draft.name || ""}
                onChange={(event) =>
                  setDraftField(
                    "name",
                    event.target.value
                  )
                }
                placeholder={activeDefinition.label}
              />
            </Field>

            <Field label="Status">
              <select
                value={
                  draft.enabled === false
                    ? "disabled"
                    : "enabled"
                }
                onChange={(event) =>
                  setDraftField(
                    "enabled",
                    event.target.value ===
                      "enabled"
                  )
                }
              >
                <option value="enabled">
                  Enabled
                </option>
                <option value="disabled">
                  Disabled
                </option>
              </select>
            </Field>
          </div>

          <Field label="Length / presentation guidance">
            <input
              value={
                draft.lengthGuidance || ""
              }
              onChange={(event) =>
                setDraftField(
                  "lengthGuidance",
                  event.target.value
                )
              }
              placeholder="Example: 1-2 pages, concise and caller-friendly"
            />
          </Field>

          <Field label={`${activeDefinition.label} instructions`}>
            <textarea
              rows={10}
              value={
                draft.instructions || ""
              }
              onChange={(event) =>
                setDraftField(
                  "instructions",
                  event.target.value
                )
              }
              placeholder="Describe the approved section order, tone, emphasis, and content rules for this report type."
              style={textareaStyle}
            />
          </Field>

          <Field label="Workspace Claude style guidance">
            <textarea
              rows={5}
              value={systemPrompt}
              onChange={(event) =>
                setSystemPrompt(
                  event.target.value
                )
              }
              placeholder="Professional workspace-level style guidance applied to every report."
              style={textareaStyle}
            />
          </Field>

          <div style={guardrailStyle}>
            <strong>
              Fixed ReachFly safeguards stay active
            </strong>
            <span>
              Manager instructions cannot authorize fabricated rankings, competitors, owners, technologies, compliance claims, or active security scanning.
            </span>
          </div>

          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <button
              type="button"
              className="rf-button rf-button--primary"
              onClick={() =>
                void saveActiveTemplate()
              }
              disabled={saving}
            >
              {saving
                ? "Saving…"
                : "Save report format"}
            </button>
          </div>
        </div>

        <aside style={referencePanelStyle}>
          <span style={eyebrowStyle}>
            Reference report
          </span>
          <h3
            style={{
              margin: "5px 0 6px",
            }}
          >
            Example PDF
          </h3>
          <p style={referenceDescriptionStyle}>
            Upload one manager-approved PDF for this report type. Claude uses its structure, layout direction, and presentation style only; names, facts, findings, metrics, and competitors are regenerated from the current lead.
          </p>

          {activeTemplate?.examplePdf ? (
            <div style={fileCardStyle}>
              <div style={pdfIconStyle}>
                PDF
              </div>
              <div style={{ minWidth: 0 }}>
                <strong
                  style={{
                    display: "block",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {activeTemplate
                    .examplePdf
                    .originalName}
                </strong>
                <span style={mutedStyle}>
                  {formatBytes(
                    activeTemplate
                      .examplePdf.size
                  )}
                  {activeTemplate
                    .examplePdf.uploadedAt
                    ? ` · ${formatDate(
                        activeTemplate
                          .examplePdf
                          .uploadedAt
                      )}`
                    : ""}
                </span>
              </div>
            </div>
          ) : (
            <div style={emptyReferenceStyle}>
              No example PDF uploaded for this report type yet.
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,.pdf"
            style={{ display: "none" }}
            onChange={(event) =>
              void uploadExample(
                event.target.files?.[0]
              )
            }
          />

          <div
            style={{
              display: "grid",
              gap: 8,
            }}
          >
            <button
              type="button"
              className="rf-button rf-button--secondary"
              onClick={() =>
                fileInputRef.current?.click()
              }
              disabled={uploading}
            >
              {uploading
                ? "Uploading…"
                : activeTemplate?.examplePdf
                  ? "Replace example PDF"
                  : "Upload example PDF"}
            </button>

            {activeTemplate?.examplePdf ? (
              <button
                type="button"
                className="rf-button rf-button--secondary"
                onClick={() =>
                  void downloadExample()
                }
              >
                View / download reference
              </button>
            ) : null}
          </div>

          <div style={versionHistoryStyle}>
            <div style={versionTitleStyle}>
              <strong>Version history</strong>
              <span style={mutedStyle}>
                Last {Math.min(
                  versions.length,
                  20
                )}
              </span>
            </div>

            {versions.length ? (
              <div
                style={{
                  display: "grid",
                  gap: 7,
                }}
              >
                {versions.map((item) => (
                  <div
                    key={item.id}
                    style={historyRowStyle}
                  >
                    <div>
                      <strong>
                        v{item.version}
                      </strong>
                      <div style={mutedStyle}>
                        {formatDate(
                          item.createdAt
                        ) || "Saved"}
                        {item.examplePdf
                          ? " · PDF"
                          : ""}
                      </div>
                    </div>
                    {item.version !==
                    activeTemplate?.version ? (
                      <button
                        type="button"
                        className="rf-button rf-button--secondary"
                        style={{
                          padding: "6px 9px",
                          fontSize: 12,
                        }}
                        disabled={
                          restoring ===
                          item.version
                        }
                        onClick={() =>
                          void restoreVersion(
                            item.version
                          )
                        }
                      >
                        {restoring ===
                        item.version
                          ? "Restoring…"
                          : "Restore"}
                      </button>
                    ) : (
                      <span
                        style={activeBadgeStyle}
                      >
                        Active
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div style={mutedStyle}>
                Save this report format to create version 1.
              </div>
            )}
          </div>
        </aside>
      </div>
    </section>
  );
}

function buildDrafts(studio) {
  return Object.fromEntries(
    REPORTS.map((definition) => {
      const active =
        studio?.templates?.[
          definition.kind
        ]?.active;

      return [
        definition.kind,
        {
          name:
            active?.name ||
            definition.label,
          enabled:
            active?.enabled !== false,
          lengthGuidance:
            active?.lengthGuidance || "",
          instructions:
            active?.instructions || "",
        },
      ];
    })
  );
}

function emptyDraft(definition) {
  return {
    name:
      definition?.label || "Audit",
    enabled: true,
    lengthGuidance: "",
    instructions: "",
  };
}

function Field({ label, children }) {
  return (
    <label
      style={{
        display: "grid",
        gap: 7,
        marginBottom: 14,
      }}
    >
      <span
        style={{
          fontSize: 12,
          fontWeight: 750,
          opacity: 0.72,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleString();
}

function formatBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "0 KB";
  if (bytes < 1024 * 1024) {
    return `${Math.max(
      1,
      Math.round(bytes / 1024)
    )} KB`;
  }
  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

const qualityBadgeStyle = {
  display: "grid",
  gap: 2,
  minWidth: 190,
  padding: "10px 12px",
  borderRadius: 12,
  border:
    "1px solid rgba(127,127,127,.22)",
};

const requiredFormatNoteStyle = {
  margin: "0 0 16px",
  padding: "12px 14px",
  border: "1px solid rgba(127,127,127,.24)",
  borderRadius: 12,
  fontSize: 13,
  lineHeight: 1.5,
};

const reportCardGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "repeat(auto-fit, minmax(220px, 1fr))",
  gap: 12,
  marginBottom: 18,
};

const reportCardStyle = {
  display: "grid",
  gap: 7,
  padding: 16,
  textAlign: "left",
  borderRadius: 14,
  border:
    "1px solid rgba(127,127,127,.18)",
  background: "transparent",
  color: "inherit",
  cursor: "pointer",
};

const selectedReportCardStyle = {
  borderColor:
    "rgba(90,115,255,.65)",
  boxShadow:
    "0 0 0 2px rgba(90,115,255,.10)",
};

const eyebrowStyle = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: ".08em",
  textTransform: "uppercase",
  opacity: 0.62,
};

const cardDescriptionStyle = {
  fontSize: 13,
  lineHeight: 1.45,
  opacity: 0.7,
  minHeight: 56,
};

const cardFooterStyle = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  fontSize: 12,
  fontWeight: 700,
  opacity: 0.7,
};

const studioGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0, 1.65fr) minmax(280px, .75fr)",
  gap: 18,
  alignItems: "start",
};

const editorStyle = {
  padding: 18,
  borderRadius: 14,
  border:
    "1px solid rgba(127,127,127,.16)",
};

const editorHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 14,
  marginBottom: 18,
};

const versionBadgeStyle = {
  padding: "5px 9px",
  borderRadius: 999,
  fontSize: 12,
  fontWeight: 800,
  background:
    "rgba(127,127,127,.10)",
};

const formGridStyle = {
  display: "grid",
  gridTemplateColumns:
    "minmax(0, 2fr) minmax(150px, .7fr)",
  gap: 12,
};

const textareaStyle = {
  width: "100%",
  resize: "vertical",
  lineHeight: 1.5,
};

const guardrailStyle = {
  display: "grid",
  gap: 5,
  padding: "12px 14px",
  marginBottom: 14,
  borderRadius: 12,
  background:
    "rgba(127,127,127,.08)",
  fontSize: 12,
  lineHeight: 1.5,
};

const referencePanelStyle = {
  display: "grid",
  gap: 12,
  padding: 18,
  borderRadius: 14,
  border:
    "1px solid rgba(127,127,127,.16)",
};

const referenceDescriptionStyle = {
  margin: 0,
  fontSize: 13,
  lineHeight: 1.5,
  opacity: 0.7,
};

const fileCardStyle = {
  display: "grid",
  gridTemplateColumns: "42px 1fr",
  gap: 10,
  alignItems: "center",
  padding: 11,
  borderRadius: 12,
  border:
    "1px solid rgba(127,127,127,.15)",
};

const pdfIconStyle = {
  display: "grid",
  placeItems: "center",
  width: 42,
  height: 42,
  borderRadius: 10,
  background:
    "rgba(127,127,127,.10)",
  fontSize: 11,
  fontWeight: 900,
};

const emptyReferenceStyle = {
  padding: 14,
  borderRadius: 12,
  border:
    "1px dashed rgba(127,127,127,.28)",
  fontSize: 13,
  lineHeight: 1.5,
  opacity: 0.65,
};

const versionHistoryStyle = {
  display: "grid",
  gap: 10,
  marginTop: 8,
  paddingTop: 14,
  borderTop:
    "1px solid rgba(127,127,127,.14)",
};

const versionTitleStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
};

const historyRowStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  padding: "9px 10px",
  borderRadius: 10,
  background:
    "rgba(127,127,127,.06)",
};

const activeBadgeStyle = {
  fontSize: 11,
  fontWeight: 850,
  padding: "4px 8px",
  borderRadius: 999,
  background:
    "rgba(80,180,120,.12)",
};

const mutedStyle = {
  fontSize: 11,
  opacity: 0.6,
};
