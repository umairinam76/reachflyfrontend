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
    kind: "mini",
    label: "Mini Audit",
    eyebrow: "DEFAULT · Website + GMB",
    description:
      "The default pre-call audit for every Website and GMB lead; one screen, verified evidence only.",
  },
  {
    kind: "competitor",
    label: "Competitor Analysis",
    eyebrow: "Website + GMB",
    description:
      "Client-facing competitor analysis generated separately for the lead's Website or GMB track.",
  },
  {
    kind: "full",
    label: "Full Audit",
    eyebrow: "INTERNAL · Website + GMB",
    description:
      "Detailed internal Full Audit generated separately for Website or GMB, with verified evidence and roadmap.",
  },
];

export default function AuditStudioPanel() {
  const [studio, setStudio] =
    useState(null);
  const [activeKind, setActiveKind] =
    useState("mini");
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
            enabled: true,
            lengthGuidance:
              draft.lengthGuidance,
            instructions:
              draft.instructions,
          },
        }
      );

      const successMessage = `${activeDefinition.label} saved as version ${result?.template?.version ?? "new"}. New audits will use this format immediately.`;
      setMessage(successMessage);
      notifyAuditStudio("success", "Audit format saved", successMessage);

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
        "true"
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

      const successMessage = `${activeDefinition.label} reference PDF uploaded as version ${result?.template?.version ?? "current"}. It will guide layout/style only; each new report remains dynamic to its lead.`;
      setMessage(successMessage);
      notifyAuditStudio("success", "Reference PDF updated", successMessage);

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

      const successMessage = `Version ${version} was restored as new active version ${result?.template?.version ?? "current"}.`;
      setMessage(successMessage);
      notifyAuditStudio("success", "Audit version restored", successMessage);
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
      <section className="rf-panel rf-audit-studio-v7">
        <AuditStudioV7Styles />
        <p>Loading Audit Studio…</p>
      </section>
    );
  }

  return (
    <section className="rf-panel rf-audit-studio-v7">
      <AuditStudioV7Styles />
      <div className="rf-panel-header">
        <div>
          <p className="rf-dashboard-eyebrow">
            AI audit studio
          </p>
          <h2>Audit Studio</h2>
          <p>
            Every lead has the same three audit levels on its own track: Mini Audit (default), Competitor Analysis, and Full Audit. Website and Business Profile are separate evidence tracks and their scores/findings are never blended. PDFs are optional layout/style references only and never block caller work.
          </p>
        </div>

        <div className="rfas-quality-badge" style={qualityBadgeStyle}>
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

      <div className="rfas-report-grid" style={reportCardGridStyle}>
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
              className={`rfas-report-card ${selected ? "active" : ""}`}
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

      <div className="rfas-track-policy" style={trackPolicyStyle}>
        <div><strong>Website track</strong><span>Mini Audit → Competitor Analysis → Full Audit</span></div>
        <div><strong>Business Profile track</strong><span>Mini Audit → Competitor Analysis → Full Audit</span></div>
        <small>Mini Audit is the default pre-call gate. Competitor Analysis is client-facing. Full Audit is internal-only.</small>
      </div>

      <div className="rfas-studio-grid" style={studioGridStyle}>
        <div className="rfas-editor" style={editorStyle}>
          <div className="rfas-editor-header" style={editorHeaderStyle}>
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

          <div className="rfas-form-grid" style={formGridStyle}>
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

            <Field label="Availability">
              <div style={alwaysOnStyle}>
                Always available · report formats can be customized, but caller audit access is never disabled.
              </div>
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

          <Field label="Workspace AI style guidance">
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

          <div className="rfas-guardrail" style={guardrailStyle}>
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

        <aside className="rfas-reference" style={referencePanelStyle}>
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
            Optional: upload one manager-approved PDF as a presentation/style reference. No PDF is required to call a lead or generate an audit. Facts, findings, metrics, scores, and competitors are always regenerated from the current lead's verified evidence.
          </p>

          {activeTemplate?.examplePdf ? (
            <div className="rfas-file-card" style={fileCardStyle}>
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
            <div className="rfas-empty-reference" style={emptyReferenceStyle}>
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

          <div className="rfas-version-history" style={versionHistoryStyle}>
            <div className="rfas-version-title" style={versionTitleStyle}>
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
                    className="rfas-history-row"
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

const alwaysOnStyle = {
  minHeight: 42,
  display: "flex",
  alignItems: "center",
  padding: "0 12px",
  border: "1px solid rgba(148,163,184,.24)",
  borderRadius: 10,
  fontSize: 13,
  opacity: 0.82,
};

const trackPolicyStyle = {
  display: "grid",
  gap: 8,
  margin: "16px 0 20px",
  padding: 14,
  border: "1px solid rgba(148,163,184,.2)",
  borderRadius: 12,
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


function notifyAuditStudio(
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

function AuditStudioV7Styles() {
  return (
    <style>{`
      .rf-audit-studio-v7{
        --rfas-card:#fff;
        --rfas-text:#191c1d;
        --rfas-text2:#4d4c59;
        --rfas-muted:#777784;
        --rfas-line:#e2e4e7;
        --rfas-primary:#4648d4;
        --rfas-primary-dark:#393bbb;
        --rfas-primary-soft:#e8e9ff;
        --rfas-violet:#6b38d4;
        --rfas-violet-soft:#f1ebff;
        --rfas-green:#087a51;
        --rfas-green-soft:#e4f7ee;
        --rfas-red:#ba1a1a;
        --rfas-red-soft:#ffedeb;
        --rfas-dark:#2e3132;
        --rfas-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        padding:18px;
        color:var(--rfas-text);
        background:
          radial-gradient(circle at 96% 3%,rgba(107,56,212,.05),transparent 24%),
          #fff;
        border:1px solid var(--rfas-line);
        border-radius:14px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .rf-audit-studio-v7 *,
      .rf-audit-studio-v7 *::before,
      .rf-audit-studio-v7 *::after{
        box-sizing:border-box;
      }

      .rf-audit-studio-v7 .rf-panel-header{
        min-height:92px;
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:18px;
        padding-bottom:15px;
        margin-bottom:15px;
        border-bottom:1px solid var(--rfas-line);
      }

      .rf-audit-studio-v7 .rf-dashboard-eyebrow{
        margin:0 0 4px;
        color:var(--rfas-primary);
        font-size:8px;
        font-weight:800;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rf-audit-studio-v7 .rf-panel-header h2{
        margin:0;
        font:600 24px/31px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rf-audit-studio-v7 .rf-panel-header p{
        max-width:850px;
        margin:5px 0 0;
        color:var(--rfas-text2);
        font-size:9px;
        line-height:15px;
      }

      .rf-audit-studio-v7 .rfas-quality-badge{
        min-width:180px!important;
        padding:10px 12px!important;
        background:linear-gradient(135deg,#f2efff,#fff)!important;
        border:1px solid #dfd8f6!important;
        border-radius:10px!important;
      }

      .rf-audit-studio-v7 .rfas-quality-badge span{
        color:var(--rfas-violet);
        font-size:5.5px!important;
        text-transform:uppercase;
      }

      .rf-audit-studio-v7 .rfas-quality-badge strong{
        font-size:7px;
      }

      .rf-audit-studio-v7 .rf-inline-alert,
      .rf-audit-studio-v7 .success-banner{
        padding:10px 11px;
        margin:0 0 11px;
        border:1px solid;
        border-radius:9px;
        font-size:7px;
        line-height:12px;
      }

      .rf-audit-studio-v7 .rf-inline-alert{
        color:#7c1d1d;
        background:var(--rfas-red-soft);
        border-color:#ffd0cc;
      }

      .rf-audit-studio-v7 .success-banner{
        color:#086846;
        background:var(--rfas-green-soft);
        border-color:#caeadb;
      }

      .rf-audit-studio-v7 .rfas-report-grid{
        grid-template-columns:repeat(3,minmax(0,1fr))!important;
        gap:8px!important;
        margin-bottom:11px!important;
      }

      .rf-audit-studio-v7 .rfas-report-card{
        min-height:150px;
        align-content:start;
        padding:13px!important;
        color:var(--rfas-text)!important;
        background:#fff!important;
        border:1px solid var(--rfas-line)!important;
        border-radius:10px!important;
        cursor:pointer;
        transition:.15s var(--rfas-ease);
      }

      .rf-audit-studio-v7 .rfas-report-card:hover{
        transform:translateY(-2px);
        border-color:#d6d6f1!important;
        box-shadow:0 8px 20px rgba(25,28,29,.05);
      }

      .rf-audit-studio-v7 .rfas-report-card.active{
        background:linear-gradient(135deg,#f5f5ff,#fff)!important;
        border-color:#bfc1ff!important;
        box-shadow:0 0 0 2px rgba(70,72,212,.07)!important;
      }

      .rf-audit-studio-v7 .rfas-report-card > span:first-child{
        color:var(--rfas-primary);
        font-size:5.5px!important;
        opacity:1!important;
      }

      .rf-audit-studio-v7 .rfas-report-card > strong{
        margin-top:8px;
        font:600 11px/15px Geist,Inter,sans-serif!important;
      }

      .rf-audit-studio-v7 .rfas-report-card > span:nth-of-type(2){
        min-height:0!important;
        color:var(--rfas-text2);
        font-size:6.5px!important;
        line-height:11px!important;
        opacity:1!important;
      }

      .rf-audit-studio-v7 .rfas-report-card > span:last-child{
        margin-top:auto;
        color:var(--rfas-muted);
        font-size:5.5px!important;
        opacity:1!important;
      }

      .rf-audit-studio-v7 .rfas-track-policy{
        gap:6px!important;
        margin:0 0 12px!important;
        padding:10px 12px!important;
        background:#f7f7fc!important;
        border:1px solid #e3e3f3!important;
        border-radius:9px!important;
      }

      .rf-audit-studio-v7 .rfas-track-policy > div{
        display:grid;
        grid-template-columns:130px minmax(0,1fr);
        align-items:center;
        gap:8px;
        min-height:27px;
      }

      .rf-audit-studio-v7 .rfas-track-policy strong{
        color:var(--rfas-primary);
        font-size:6px;
      }

      .rf-audit-studio-v7 .rfas-track-policy span,
      .rf-audit-studio-v7 .rfas-track-policy small{
        color:var(--rfas-text2);
        font-size:6px;
        line-height:10px;
      }

      .rf-audit-studio-v7 .rfas-studio-grid{
        grid-template-columns:minmax(0,1.55fr) minmax(285px,.72fr)!important;
        gap:11px!important;
      }

      .rf-audit-studio-v7 .rfas-editor,
      .rf-audit-studio-v7 .rfas-reference{
        padding:14px!important;
        background:#fff;
        border:1px solid var(--rfas-line)!important;
        border-radius:11px!important;
      }

      .rf-audit-studio-v7 .rfas-editor-header{
        margin-bottom:12px!important;
        padding-bottom:10px;
        border-bottom:1px solid #eff0f1;
      }

      .rf-audit-studio-v7 .rfas-editor-header span:first-child,
      .rf-audit-studio-v7 .rfas-reference > span:first-child{
        color:var(--rfas-primary);
        font-size:5.5px!important;
        opacity:1!important;
      }

      .rf-audit-studio-v7 .rfas-editor-header h3,
      .rf-audit-studio-v7 .rfas-reference h3{
        font:600 14px/19px Geist,Inter,sans-serif;
      }

      .rf-audit-studio-v7 .rfas-editor-header > span:last-child{
        padding:5px 7px!important;
        color:var(--rfas-primary);
        background:var(--rfas-primary-soft)!important;
        border-radius:999px!important;
        font-size:5.5px!important;
      }

      .rf-audit-studio-v7 .rfas-form-grid{
        grid-template-columns:minmax(0,1.35fr) minmax(180px,.65fr)!important;
        gap:8px!important;
      }

      .rf-audit-studio-v7 label{
        display:grid;
        gap:4px!important;
        margin-bottom:9px;
      }

      .rf-audit-studio-v7 label > span{
        color:var(--rfas-muted);
        font-size:5.8px!important;
        font-weight:750!important;
        letter-spacing:.03em;
        text-transform:uppercase;
      }

      .rf-audit-studio-v7 input,
      .rf-audit-studio-v7 textarea{
        width:100%;
        min-height:39px;
        padding:8px 9px;
        color:var(--rfas-text);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
        outline:0;
        font:400 7px/12px Inter,sans-serif;
        transition:.13s var(--rfas-ease);
      }

      .rf-audit-studio-v7 textarea{
        resize:vertical!important;
      }

      .rf-audit-studio-v7 input:focus,
      .rf-audit-studio-v7 textarea:focus{
        background:#fff;
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rf-audit-studio-v7 .rfas-form-grid label:last-child > div{
        min-height:39px!important;
        padding:8px 9px!important;
        color:var(--rfas-text2);
        background:#f7f8f9;
        border:1px solid var(--rfas-line)!important;
        border-radius:8px!important;
        font-size:6.3px!important;
        line-height:10px;
      }

      .rf-audit-studio-v7 .rfas-guardrail{
        gap:3px!important;
        padding:10px 11px!important;
        margin-bottom:10px!important;
        color:#4c465a;
        background:var(--rfas-violet-soft)!important;
        border:1px solid #e3daf8;
        border-radius:9px!important;
        font-size:6.3px!important;
        line-height:11px!important;
      }

      .rf-audit-studio-v7 .rf-button{
        min-height:38px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:7px 10px;
        border:1px solid transparent;
        border-radius:8px;
        cursor:pointer;
        font:700 6.5px/1 Inter,sans-serif;
        transition:.14s var(--rfas-ease);
      }

      .rf-audit-studio-v7 .rf-button:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rf-audit-studio-v7 .rf-button:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rf-audit-studio-v7 .rf-button--primary{
        color:#fff;
        background:var(--rfas-primary);
        border-color:var(--rfas-primary);
      }

      .rf-audit-studio-v7 .rf-button--secondary{
        color:var(--rfas-text);
        background:#fff;
        border-color:var(--rfas-line);
      }

      .rf-audit-studio-v7 .rfas-reference{
        position:sticky;
        top:78px;
      }

      .rf-audit-studio-v7 .rfas-reference > p{
        color:var(--rfas-text2)!important;
        font-size:6.5px!important;
        line-height:11px!important;
        opacity:1!important;
      }

      .rf-audit-studio-v7 .rfas-file-card{
        grid-template-columns:37px minmax(0,1fr)!important;
        padding:9px!important;
        background:#f7f8f9;
        border:1px solid var(--rfas-line)!important;
        border-radius:8px!important;
      }

      .rf-audit-studio-v7 .rfas-file-card > div:first-child{
        width:37px!important;
        height:37px!important;
        color:var(--rfas-primary);
        background:var(--rfas-primary-soft)!important;
        border-radius:8px!important;
        font-size:5.5px!important;
      }

      .rf-audit-studio-v7 .rfas-empty-reference{
        padding:11px!important;
        color:var(--rfas-muted);
        background:#f8f9fa;
        border:1px dashed #d9dbdf!important;
        border-radius:8px!important;
        font-size:6.2px!important;
        line-height:10px!important;
        opacity:1!important;
      }

      .rf-audit-studio-v7 .rfas-version-history{
        gap:7px!important;
        margin-top:4px!important;
        padding-top:11px!important;
      }

      .rf-audit-studio-v7 .rfas-version-title strong{
        font-size:7px;
      }

      .rf-audit-studio-v7 .rfas-history-row{
        min-height:48px;
        padding:8px!important;
        background:#f7f8f9!important;
        border:1px solid transparent;
        border-radius:8px!important;
      }

      .rf-audit-studio-v7 .rfas-history-row strong{
        font-size:6.5px;
      }

      @media(max-width:980px){
        .rf-audit-studio-v7 .rfas-studio-grid{
          grid-template-columns:1fr!important;
        }

        .rf-audit-studio-v7 .rfas-reference{
          position:static;
        }
      }

      @media(max-width:720px){
        .rf-audit-studio-v7{
          padding:14px;
        }

        .rf-audit-studio-v7 .rf-panel-header{
          flex-direction:column;
        }

        .rf-audit-studio-v7 .rfas-quality-badge{
          width:100%;
        }

        .rf-audit-studio-v7 .rfas-report-grid{
          grid-template-columns:1fr!important;
        }

        .rf-audit-studio-v7 .rfas-form-grid{
          grid-template-columns:1fr!important;
        }

        .rf-audit-studio-v7 .rfas-track-policy > div{
          grid-template-columns:1fr;
          gap:2px;
        }

        .rf-audit-studio-v7 .rf-button{
          width:100%;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-audit-studio-v7 *,
        .rf-audit-studio-v7 *::before,
        .rf-audit-studio-v7 *::after{
          transition-duration:.01ms!important;
          animation:none!important;
        }
      }
    `}</style>
  );
}
