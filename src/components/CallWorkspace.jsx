import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useSearchParams } from "react-router-dom";

import {
  apiRequest,
  onWorkspaceSocket,
} from "../lib/workspace-platform-client.js";

import MiniAuditPanel from "../pages/MiniAuditPanel.jsx";

import "../styles.css";

const CALL_OUTCOMES = [
  {
    value: "no_answer",
    label: "No answer",
  },
  {
    value: "busy",
    label: "Busy",
  },
  {
    value: "voicemail",
    label: "Voicemail",
  },
  {
    value: "connected",
    label: "Connected",
  },
  {
    value: "interested",
    label: "Interested",
  },
  {
    value: "qualified",
    label: "Qualified",
  },
  {
    value: "meeting_booked",
    label: "Meeting booked",
  },
  {
    value: "follow_up",
    label: "Follow-up required",
  },
  {
    value: "not_interested",
    label: "Not interested",
  },
  {
    value: "wrong_number",
    label: "Wrong number",
  },
  {
    value: "do_not_contact",
    label: "Do not contact",
  },
];

const ASSIGNMENT_STATUSES = [
  "assigned",
  "in_progress",
  "follow_up",
  "qualified",
  "meeting_booked",
  "completed",
  "do_not_contact",
];

export default function CallWorkspace() {
  const [searchParams] = useSearchParams();

  const assignmentId =
    searchParams.get("assignmentId") || "";

  const leadId =
    searchParams.get("leadId") || "";

  const [profile, setProfile] =
    useState(null);

  const [assignment, setAssignment] =
    useState(null);

  const [lead, setLead] =
    useState(null);

  const [miniAudit, setMiniAudit] =
    useState(null);

  const [callHistory, setCallHistory] =
    useState([]);

  const [activeCall, setActiveCall] =
    useState(null);

  const [callStatus, setCallStatus] =
    useState("idle");

  const [callStartedAt, setCallStartedAt] =
    useState(null);

  const [elapsedSeconds, setElapsedSeconds] =
    useState(0);

  const [muted, setMuted] =
    useState(false);

  const [speakerEnabled, setSpeakerEnabled] =
    useState(true);

  const [outcome, setOutcome] =
    useState("");

  const [notes, setNotes] =
    useState("");

  const [followUpAt, setFollowUpAt] =
    useState("");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [startingCall, setStartingCall] =
    useState(false);

  const [endingCall, setEndingCall] =
    useState(false);

  const [savingOutcome, setSavingOutcome] =
    useState(false);

  const [generatingAudit, setGeneratingAudit] =
    useState(false);

  const [generatingFullAudit, setGeneratingFullAudit] =
    useState(false);

  const [
    generatingCompetitorAnalysis,
    setGeneratingCompetitorAnalysis,
  ] = useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  const [activeTab, setActiveTab] =
    useState("audit");

  useEffect(() => {
    if (!success) {
      return;
    }

    notifyCallWorkspace(
      "success",
      "Call workspace updated",
      success
    );
  }, [success]);

  const audioRef = useRef(null);

  const callTimerRef = useRef(null);

  const startCallRequestRef = useRef("");

  const currentCallId =
    activeCall?.id ||
    activeCall?.callId ||
    "";

  const loadWorkspace = useCallback(
    async ({
      silent = false,
    } = {}) => {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setError("");

      try {
        const profileResponse =
          await apiRequest("/profile/me");

        setProfile(
          profileResponse.profile ||
            profileResponse.user ||
            profileResponse
        );

        let assignmentResponse = null;

        if (assignmentId) {
          assignmentResponse =
            await apiRequest(
              `/team-management/assignments/${encodeURIComponent(
                assignmentId
              )}`
            );
        }

        const resolvedAssignment =
          assignmentResponse?.assignment ||
          assignmentResponse ||
          null;

        setAssignment(
          resolvedAssignment
        );

        const resolvedLeadId =
          leadId ||
          resolvedAssignment?.leadId ||
          resolvedAssignment?.lead?.id ||
          "";

        if (!resolvedLeadId) {
          throw new Error(
            "A lead ID is required to open the call workspace."
          );
        }

        const [
          leadResponse,
          historyResponse,
        ] = await Promise.all([
          apiRequest(
            `/leads/${encodeURIComponent(
              resolvedLeadId
            )}`
          ),

          apiRequest(
            `/calls?leadId=${encodeURIComponent(
              resolvedLeadId
            )}&limit=100`
          ),
        ]);

        const resolvedLead =
          leadResponse.lead ||
          leadResponse;

        setLead(resolvedLead);

        setMiniAudit(
          resolvedLead.miniAudit ||
            leadResponse.miniAudit ||
            null
        );

        setCallHistory(
          historyResponse.calls ||
            historyResponse.records ||
            []
        );

        setNotes(
          resolvedAssignment?.notes ||
            ""
        );

        setFollowUpAt(
          toLocalDateTimeInput(
            resolvedAssignment?.nextActionAt
          )
        );

        const active =
          historyResponse.activeCall ||
          resolvedLead.activeCall ||
          null;

        if (active) {
          setActiveCall(active);

          setCallStatus(
            normalizeCallStatus(
              active.status ||
                "connecting"
            )
          );

          setCallStartedAt(
            active.startedAt ||
              active.createdAt ||
              null
          );
        }
      } catch (requestError) {
        setError(
          requestError?.message ||
            "The call workspace could not be loaded."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [
      assignmentId,
      leadId,
    ]
  );

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    const subscriptions = [
      onWorkspaceSocket(
        "call:status",
        handleCallStatusEvent
      ),

      onWorkspaceSocket(
        "call:answered",
        handleCallStatusEvent
      ),

      onWorkspaceSocket(
        "call:completed",
        handleCallCompletedEvent
      ),

      onWorkspaceSocket(
        "call:failed",
        handleCallCompletedEvent
      ),

      onWorkspaceSocket(
        "lead:audit-updated",
        handleAuditUpdatedEvent
      ),

      onWorkspaceSocket(
        "lead:updated",
        handleLeadUpdatedEvent
      ),

      onWorkspaceSocket(
        "team:assignment-updated",
        handleAssignmentUpdatedEvent
      ),
    ];

    return () => {
      for (const unsubscribe of subscriptions) {
        unsubscribe();
      }
    };
  }, [
    currentCallId,
    lead?.id,
    assignment?.id,
  ]);

  useEffect(() => {
    clearInterval(
      callTimerRef.current
    );

    if (
      !callStartedAt ||
      ![
        "ringing",
        "connecting",
        "answered",
        "connected",
        "in_progress",
      ].includes(callStatus)
    ) {
      if (
        !activeCall &&
        callStatus === "idle"
      ) {
        setElapsedSeconds(0);
      }

      return undefined;
    }

    const updateElapsed = () => {
      const started =
        Date.parse(callStartedAt);

      if (
        !Number.isFinite(started)
      ) {
        return;
      }

      setElapsedSeconds(
        Math.max(
          0,
          Math.floor(
            (Date.now() -
              started) /
              1000
          )
        )
      );
    };

    updateElapsed();

    callTimerRef.current =
      setInterval(
        updateElapsed,
        1000
      );

    return () => {
      clearInterval(
        callTimerRef.current
      );
    };
  }, [
    callStartedAt,
    callStatus,
    activeCall,
  ]);

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.muted =
      !speakerEnabled;
  }, [speakerEnabled]);

  useEffect(() => {
    const status = normalizeStatus(
      lead?.miniAuditStatus ||
        miniAudit?.status ||
        ""
    );

    const isPending = [
      "queued",
      "pending",
      "processing",
      "running",
      "generating",
    ].includes(status);

    if (!lead?.id || !isPending) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void loadWorkspace({
        silent: true,
      });
    }, 3000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [
    lead?.id,
    lead?.miniAuditStatus,
    miniAudit?.status,
    loadWorkspace,
  ]);

  function handleCallStatusEvent(
    event
  ) {
    const eventCallId =
      event?.callId ||
      event?.call?.id ||
      "";

    if (
      currentCallId &&
      eventCallId &&
      eventCallId !==
        currentCallId
    ) {
      return;
    }

    const call =
      event.call ||
      event;

    setActiveCall((current) => ({
      ...(current || {}),
      ...call,
    }));

    const nextStatus =
      normalizeCallStatus(
        call.status ||
          event.status ||
          "connecting"
      );

    setCallStatus(nextStatus);

    if (
      !callStartedAt &&
      (call.startedAt ||
        call.createdAt)
    ) {
      setCallStartedAt(
        call.startedAt ||
          call.createdAt
      );
    }

    if (
      call.audioUrl &&
      audioRef.current
    ) {
      audioRef.current.src =
        call.audioUrl;

      audioRef.current
        .play()
        .catch(() => {});
    }
  }

  function handleCallCompletedEvent(
    event
  ) {
    const eventCallId =
      event?.callId ||
      event?.call?.id ||
      "";

    if (
      currentCallId &&
      eventCallId &&
      eventCallId !==
        currentCallId
    ) {
      return;
    }

    const completedCall =
      event.call ||
      event;

    setCallStatus(
      normalizeCallStatus(
        completedCall.status ||
          "completed"
      )
    );

    setActiveCall(null);

    startCallRequestRef.current = "";

    setCallStartedAt(null);

    setElapsedSeconds(
      Number(
        completedCall.durationSeconds ||
          completedCall.duration ||
          elapsedSeconds ||
          0
      )
    );

    setCallHistory((current) => {
      const exists =
        current.some(
          (call) =>
            call.id ===
              completedCall.id ||
            call.callId ===
              completedCall.callId
        );

      if (exists) {
        return current.map(
          (call) =>
            call.id ===
              completedCall.id ||
            call.callId ===
              completedCall.callId
              ? {
                  ...call,
                  ...completedCall,
                }
              : call
        );
      }

      return [
        completedCall,
        ...current,
      ];
    });
  }

  function handleAuditUpdatedEvent(
    event
  ) {
    if (
      event?.leadId &&
      event.leadId !== lead?.id
    ) {
      return;
    }

    const audit =
      event.miniAudit ||
      event.audit ||
      event.lead?.miniAudit ||
      null;

    if (audit) {
      setMiniAudit(audit);
    }

    if (event.lead) {
      setLead((current) => ({
        ...(current || {}),
        ...event.lead,
      }));
    }

    setGeneratingAudit(false);
    setGeneratingFullAudit(false);
    setGeneratingCompetitorAnalysis(false);
  }

  function handleLeadUpdatedEvent(
    event
  ) {
    const updated =
      event.lead ||
      event;

    if (
      updated?.id !== lead?.id
    ) {
      return;
    }

    setLead((current) => ({
      ...(current || {}),
      ...updated,
    }));

    if (updated.miniAudit) {
      setMiniAudit(
        updated.miniAudit
      );
    }
  }

  function handleAssignmentUpdatedEvent(
    event
  ) {
    const updated =
      event.assignment ||
      event;

    if (
      updated?.id !==
      assignment?.id
    ) {
      return;
    }

    setAssignment((current) => ({
      ...(current || {}),
      ...updated,
    }));
  }

  async function startCall() {
    if (startingCall || activeCall) {
      return;
    }

    if (
      lead?.activeCall ||
      lead?.contactLocked ||
      assignment?.contactLocked
    ) {
      setError(
        "This lead is already being contacted by another team member."
      );

      return;
    }

    if (!lead?.phone) {
      setError(
        "This lead does not have a valid phone number."
      );

      return;
    }

    const idempotencyKey =
      startCallRequestRef.current ||
      createRequestId();

    startCallRequestRef.current =
      idempotencyKey;

    setStartingCall(true);
    setError("");
    setSuccess("");

    try {
      const response =
        await apiRequest(
          "/calls/start",
          {
            method: "POST",
            body: {
              assignmentId:
                assignment?.id ||
                assignmentId ||
                null,
              leadId: lead.id,
              toNumber:
                lead.phone,
              dialerId:
                profile
                  ?.assignedDialerId ||
                profile
                  ?.assignedDialer
                  ?.id ||
                null,
              idempotencyKey,
            },
          }
        );

      const call =
        response.call ||
        response;

      setActiveCall(call);

      setCallStatus(
        normalizeCallStatus(
          call.status ||
            "connecting"
        )
      );

      setCallStartedAt(
        call.startedAt ||
          call.createdAt ||
          new Date().toISOString()
      );

      setElapsedSeconds(0);

      setOutcome("");

      setSuccess(
        `Calling ${
          lead.business ||
          lead.name ||
          lead.phone
        }.`
      );

      if (assignment?.id) {
        await updateAssignment({
          status: "in_progress",
        });
      }
    } catch (requestError) {
      startCallRequestRef.current = "";

      setError(
        requestError?.message ||
          "The call could not be started."
      );
    } finally {
      setStartingCall(false);
    }
  }

  async function endCall() {
    if (!currentCallId) {
      return;
    }

    setEndingCall(true);
    setError("");

    try {
      const response =
        await apiRequest(
          `/calls/${encodeURIComponent(
            currentCallId
          )}/end`,
          {
            method: "POST",
          }
        );

      const completed =
        response.call ||
        response;

      setActiveCall(null);

      startCallRequestRef.current = "";

      setCallStatus(
        normalizeCallStatus(
          completed.status ||
            "completed"
        )
      );

      setCallStartedAt(null);

      setElapsedSeconds(
        Number(
          completed.durationSeconds ||
            elapsedSeconds ||
            0
        )
      );

      setCallHistory((current) => [
        completed,
        ...current.filter(
          (call) =>
            call.id !==
              completed.id &&
            call.callId !==
              completed.callId
        ),
      ]);
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The call could not be ended."
      );
    } finally {
      setEndingCall(false);
    }
  }

  async function toggleMute() {
    const nextMuted = !muted;

    setMuted(nextMuted);

    if (!currentCallId) {
      return;
    }

    try {
      await apiRequest(
        `/calls/${encodeURIComponent(
          currentCallId
        )}/mute`,
        {
          method: "POST",
          body: {
            muted: nextMuted,
          },
        }
      );
    } catch (requestError) {
      setMuted(!nextMuted);

      setError(
        requestError?.message ||
          "The mute setting could not be changed."
      );
    }
  }

  async function saveCallOutcome() {
    if (!outcome) {
      setError(
        "Select a call outcome before saving."
      );

      return;
    }

    setSavingOutcome(true);
    setError("");
    setSuccess("");

    try {
      const latestCall =
        activeCall ||
        callHistory[0] ||
        null;

      const response =
        await apiRequest(
          latestCall?.id ||
            latestCall?.callId
            ? `/calls/${encodeURIComponent(
                latestCall.id ||
                  latestCall.callId
              )}/outcome`
            : "/calls/outcome",
          {
            method: "POST",
            body: {
              assignmentId:
                assignment?.id ||
                assignmentId ||
                null,
              leadId: lead.id,
              outcome,
              notes:
                notes.trim(),
              followUpAt:
                followUpAt
                  ? new Date(
                      followUpAt
                    ).toISOString()
                  : null,
            },
          }
        );

      const updatedCall =
        response.call ||
        response;

      setCallHistory((current) => {
        const id =
          updatedCall.id ||
          updatedCall.callId;

        const exists =
          current.some(
            (call) =>
              call.id === id ||
              call.callId === id
          );

        if (!exists) {
          return [
            updatedCall,
            ...current,
          ];
        }

        return current.map(
          (call) =>
            call.id === id ||
            call.callId === id
              ? {
                  ...call,
                  ...updatedCall,
                }
              : call
        );
      });

      const assignmentStatus =
        mapOutcomeToAssignmentStatus(
          outcome
        );

      await updateAssignment({
        status: assignmentStatus,
        notes: notes.trim(),
        nextActionAt:
          followUpAt
            ? new Date(
                followUpAt
              ).toISOString()
            : null,
      });

      setSuccess(
        "The call outcome was saved successfully."
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The call outcome could not be saved."
      );
    } finally {
      setSavingOutcome(false);
    }
  }

  async function updateAssignment(
    patch
  ) {
    if (!assignment?.id) {
      return null;
    }

    const response =
      await apiRequest(
        `/team-management/assignments/${encodeURIComponent(
          assignment.id
        )}`,
        {
          method: "PATCH",
          body: patch,
        }
      );

    const updated =
      response.assignment ||
      response;

    setAssignment((current) => ({
      ...(current || {}),
      ...updated,
    }));

    return updated;
  }

  async function updateAssignmentStatus(
    status
  ) {
    try {
      await updateAssignment({
        status,
      });

      setSuccess(
        "The assignment status was updated."
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The assignment status could not be updated."
      );
    }
  }

  async function generateMiniAudit() {
    if (!lead?.website) {
      setError(
        "A website is required to generate a mini audit."
      );

      return;
    }

    setGeneratingAudit(true);
    setError("");
    setSuccess("");

    try {
      const response =
        await apiRequest(
          `/leads/${encodeURIComponent(
            lead.id
          )}/mini-audit`,
          {
            method: "POST",
          }
        );

      const audit =
        response.miniAudit ||
        response.audit ||
        null;

      if (audit) {
        setMiniAudit(audit);
      }

      setLead((current) => ({
        ...(current || {}),
        miniAuditStatus:
          audit
            ? "completed"
            : "queued",
        ...(audit
          ? {
              miniAudit:
                audit,
            }
          : {}),
      }));

      setSuccess(
        audit
          ? "The mini audit is ready."
          : "The mini audit was queued for background generation."
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The mini audit could not be generated."
      );
    } finally {
      setGeneratingAudit(false);
    }
  }

  async function generateFullAudit() {
    if (!lead?.website) {
      setError(
        "A website is required to generate a full audit."
      );

      return;
    }

    setGeneratingFullAudit(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest(
        `/leads/${encodeURIComponent(
          lead.id
        )}/full-audit`,
        {
          method: "POST",
        }
      );

      setSuccess(
        "The full audit report was queued for background generation."
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The full audit report could not be generated."
      );
    } finally {
      setGeneratingFullAudit(false);
    }
  }

  async function generateCompetitorAnalysis() {
    if (!lead?.website) {
      setError(
        "A website is required to generate competitor analysis."
      );

      return;
    }

    setGeneratingCompetitorAnalysis(true);
    setError("");
    setSuccess("");

    try {
      await apiRequest(
        `/leads/${encodeURIComponent(
          lead.id
        )}/competitor-analysis`,
        {
          method: "POST",
        }
      );

      setSuccess(
        "The competitor analysis was queued for background generation."
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The competitor analysis could not be generated."
      );
    } finally {
      setGeneratingCompetitorAnalysis(false);
    }
  }

  const isCallActive =
    Boolean(activeCall) &&
    ![
      "completed",
      "failed",
      "cancelled",
      "rejected",
    ].includes(callStatus);

  const callButtonLabel =
    startingCall
      ? "Starting call…"
      : isCallActive
        ? formatLabel(callStatus)
        : "Call lead";

  const leadName =
    lead?.business ||
    lead?.name ||
    "Business lead";

  const latestCall =
    callHistory[0] ||
    null;

  const miniAuditStatus =
    normalizeStatus(
      lead?.miniAuditStatus ||
        miniAudit?.status ||
        ""
    );

  if (loading) {
    return <CallWorkspaceSkeleton />;
  }

  if (!lead) {
    return (
      <main className="rf-call-workspace rf-call-workspace-v7">
      <CallWorkspaceLegacyV7Styles />
        <section className="rf-call-empty-state">
          <div>!</div>

          <h1>
            Lead not available
          </h1>

          <p>
            The selected lead could not
            be found or is no longer
            assigned to your account.
          </p>

          <a href="/app/my-leads">
            Return to my leads
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="rf-call-workspace rf-call-workspace-v7">
      <CallWorkspaceLegacyV7Styles />
      <audio
        ref={audioRef}
        autoPlay
        playsInline
      />

      <CallWorkspaceHeader
        lead={lead}
        assignment={assignment}
        refreshing={refreshing}
        onRefresh={() =>
          loadWorkspace({
            silent: true,
          })
        }
      />

      {error ? (
        <WorkspaceAlert
          type="error"
          message={error}
          onClose={() =>
            setError("")
          }
        />
      ) : null}

      {success ? (
        <WorkspaceAlert
          type="success"
          message={success}
          onClose={() =>
            setSuccess("")
          }
        />
      ) : null}

      <section className="rf-call-layout">
        <div className="rf-call-layout__primary">
          <CallControlCard
            lead={lead}
            assignment={assignment}
            isCallActive={isCallActive}
            callStatus={callStatus}
            callStartedAt={callStartedAt}
            elapsedSeconds={
              elapsedSeconds
            }
            muted={muted}
            speakerEnabled={
              speakerEnabled
            }
            startingCall={
              startingCall
            }
            endingCall={
              endingCall
            }
            callButtonLabel={
              callButtonLabel
            }
            onStartCall={startCall}
            onEndCall={endCall}
            onToggleMute={
              toggleMute
            }
            onToggleSpeaker={() =>
              setSpeakerEnabled(
                (current) =>
                  !current
              )
            }
          />

          <CallOutcomeCard
            assignment={assignment}
            outcome={outcome}
            notes={notes}
            followUpAt={followUpAt}
            saving={savingOutcome}
            onOutcomeChange={
              setOutcome
            }
            onNotesChange={
              setNotes
            }
            onFollowUpChange={
              setFollowUpAt
            }
            onSave={
              saveCallOutcome
            }
            onAssignmentStatusChange={
              updateAssignmentStatus
            }
          />

          <CallHistoryCard
            calls={callHistory}
            latestCall={latestCall}
          />
        </div>

        <aside className="rf-call-layout__secondary">
          <LeadContactCard
            lead={lead}
            assignment={assignment}
          />

          <section className="rf-call-information-panel">
            <nav className="rf-call-tabs">
              <button
                type="button"
                className={
                  activeTab ===
                  "audit"
                    ? "is-active"
                    : ""
                }
                onClick={() =>
                  setActiveTab(
                    "audit"
                  )
                }
              >
                Mini audit
              </button>

              <button
                type="button"
                className={
                  activeTab ===
                  "instructions"
                    ? "is-active"
                    : ""
                }
                onClick={() =>
                  setActiveTab(
                    "instructions"
                  )
                }
              >
                Instructions
              </button>
            </nav>

            {activeTab ===
            "audit" ? (
              <MiniAuditPanel
                lead={lead}
                audit={miniAudit}
                status={
                  miniAuditStatus
                }
                generating={
                  generatingAudit
                }
                generatingFullAudit={
                  generatingFullAudit
                }
                generatingCompetitorAnalysis={
                  generatingCompetitorAnalysis
                }
                onGenerateMiniAudit={
                  generateMiniAudit
                }
                onGenerateFullAudit={
                  generateFullAudit
                }
                onGenerateCompetitorAnalysis={
                  generateCompetitorAnalysis
                }
              />
            ) : (
              <AssignmentInstructions
                assignment={
                  assignment
                }
              />
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}

function CallWorkspaceHeader({
  lead,
  assignment,
  refreshing,
  onRefresh,
}) {
  return (
    <header className="rf-call-header">
      <div className="rf-call-header__identity">
        <LeadAvatar
          lead={lead}
          large
        />

        <div>
          <p className="rf-call-eyebrow">
            Live call workspace
          </p>

          <h1>
            {lead.business ||
              lead.name ||
              "Business lead"}
          </h1>

          <p>
            {[
              lead.category,
              lead.address ||
                lead.location,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
      </div>

      <div className="rf-call-header__actions">
        <AssignmentBadge
          assignment={assignment}
        />

        <button
          type="button"
          className="rf-call-button rf-call-button--secondary"
          onClick={onRefresh}
          disabled={refreshing}
        >
          {refreshing
            ? "Refreshing…"
            : "Refresh"}
        </button>

        <a
          href="/app/my-leads"
          className="rf-call-button rf-call-button--secondary"
        >
          Back to leads
        </a>
      </div>
    </header>
  );
}

function CallControlCard({
  lead,
  assignment,
  isCallActive,
  callStatus,
  callStartedAt,
  elapsedSeconds,
  muted,
  speakerEnabled,
  startingCall,
  endingCall,
  callButtonLabel,
  onStartCall,
  onEndCall,
  onToggleMute,
  onToggleSpeaker,
}) {
  return (
    <section
      className={`rf-call-control-card ${
        isCallActive
          ? "is-active"
          : ""
      }`}
    >
      <div className="rf-call-control-card__identity">
        <LeadAvatar
          lead={lead}
          extraLarge
        />

        <div>
          <p className="rf-call-eyebrow">
            {isCallActive
              ? "Call in progress"
              : "Ready to call"}
          </p>

          <h2>
            {lead.business ||
              lead.name ||
              lead.phone}
          </h2>

          <a href={`tel:${lead.phone}`}>
            {lead.phone ||
              "No phone number"}
          </a>

          <span>
            {assignment?.priority
              ? `${formatLabel(
                  assignment.priority
                )} priority`
              : "Normal priority"}
          </span>
        </div>
      </div>

      <div className="rf-call-live-status">
        <CallStatusBadge
          status={callStatus}
        />

        <strong>
          {formatDuration(
            elapsedSeconds
          )}
        </strong>

        <small>
          {callStartedAt
            ? `Started ${formatTime(
                callStartedAt
              )}`
            : "Call timer"}
        </small>
      </div>

      <div className="rf-call-control-actions">
        {!isCallActive ? (
          <button
            type="button"
            className="rf-call-button rf-call-button--primary rf-call-button--large"
            onClick={onStartCall}
            disabled={
              startingCall ||
              !lead.phone
            }
          >
            <span className="rf-call-button-icon">
              ☎
            </span>

            {callButtonLabel}
          </button>
        ) : (
          <>
            <button
              type="button"
              className={`rf-round-call-button ${
                muted
                  ? "is-active"
                  : ""
              }`}
              onClick={onToggleMute}
              title={
                muted
                  ? "Unmute"
                  : "Mute"
              }
            >
              {muted
                ? "M"
                : "MIC"}
            </button>

            <button
              type="button"
              className={`rf-round-call-button ${
                speakerEnabled
                  ? "is-active"
                  : ""
              }`}
              onClick={
                onToggleSpeaker
              }
              title="Speaker"
            >
              SPK
            </button>

            <button
              type="button"
              className="rf-call-button rf-call-button--danger rf-call-button--large"
              onClick={onEndCall}
              disabled={endingCall}
            >
              {endingCall
                ? "Ending…"
                : "End call"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function CallOutcomeCard({
  assignment,
  outcome,
  notes,
  followUpAt,
  saving,
  onOutcomeChange,
  onNotesChange,
  onFollowUpChange,
  onSave,
  onAssignmentStatusChange,
}) {
  return (
    <section className="rf-call-panel">
      <PanelHeader
        title="Call outcome"
        subtitle="Record the result, key notes and any required follow-up."
      />

      <div className="rf-call-outcome-grid">
        <label className="rf-call-field">
          <span>Outcome</span>

          <select
            value={outcome}
            onChange={(event) =>
              onOutcomeChange(
                event.target.value
              )
            }
          >
            <option value="">
              Select call outcome
            </option>

            {CALL_OUTCOMES.map(
              (item) => (
                <option
                  key={item.value}
                  value={item.value}
                >
                  {item.label}
                </option>
              )
            )}
          </select>
        </label>

        <label className="rf-call-field">
          <span>
            Assignment status
          </span>

          <select
            value={
              assignment?.status ||
              "assigned"
            }
            onChange={(event) =>
              onAssignmentStatusChange(
                event.target.value
              )
            }
            disabled={
              !assignment?.id
            }
          >
            {ASSIGNMENT_STATUSES.map(
              (status) => (
                <option
                  key={status}
                  value={status}
                >
                  {formatLabel(status)}
                </option>
              )
            )}
          </select>
        </label>

        <label className="rf-call-field rf-call-field--wide">
          <span>Call notes</span>

          <textarea
            value={notes}
            onChange={(event) =>
              onNotesChange(
                event.target.value
              )
            }
            placeholder="Record the conversation, objections, level of interest, decision-maker details and next steps."
          />
        </label>

        <label className="rf-call-field rf-call-field--wide">
          <span>
            Follow-up date and time
          </span>

          <input
            type="datetime-local"
            value={followUpAt}
            onChange={(event) =>
              onFollowUpChange(
                event.target.value
              )
            }
          />
        </label>
      </div>

      <footer className="rf-call-panel-footer">
        <button
          type="button"
          className="rf-call-button rf-call-button--primary"
          onClick={onSave}
          disabled={
            saving ||
            !outcome
          }
        >
          {saving
            ? "Saving outcome…"
            : "Save call outcome"}
        </button>
      </footer>
    </section>
  );
}

function CallHistoryCard({
  calls,
}) {
  return (
    <section className="rf-call-panel">
      <PanelHeader
        title="Call history"
        subtitle="Every call attempt for this lead is stored for accountability."
      />

      {!calls.length ? (
        <div className="rf-call-empty">
          <div>CH</div>

          <strong>
            No calls recorded
          </strong>

          <p>
            Your first call attempt will
            appear here automatically.
          </p>
        </div>
      ) : (
        <div className="rf-call-history-list">
          {calls.map(
            (call, index) => (
              <article
                key={
                  call.id ||
                  call.callId ||
                  index
                }
                className="rf-call-history-item"
              >
                <div className="rf-call-history-icon">
                  ☎
                </div>

                <div className="rf-call-history-content">
                  <strong>
                    {formatLabel(
                      call.outcome ||
                        call.status ||
                        "call"
                    )}
                  </strong>

                  <span>
                    {formatDateTime(
                      call.startedAt ||
                        call.createdAt
                    )}
                  </span>

                  {call.notes ? (
                    <p>
                      {call.notes}
                    </p>
                  ) : null}
                </div>

                <div className="rf-call-history-meta">
                  <CallStatusBadge
                    status={
                      call.status ||
                      "completed"
                    }
                  />

                  <strong>
                    {formatDuration(
                      call.durationSeconds ||
                        call.duration ||
                        0
                    )}
                  </strong>

                  <small>
                    {call.fromNumber
                      ? `From ${call.fromNumber}`
                      : ""}
                  </small>
                </div>
              </article>
            )
          )}
        </div>
      )}
    </section>
  );
}

function LeadContactCard({
  lead,
  assignment,
}) {
  return (
    <section className="rf-call-contact-card">
      <header>
        <LeadAvatar
          lead={lead}
          large
        />

        <div>
          <h2>
            {lead.business ||
              lead.name}
          </h2>

          <p>
            {lead.category ||
              "Business lead"}
          </p>
        </div>
      </header>

      <div className="rf-call-contact-list">
        <ContactRow
          label="Phone"
          value={
            lead.phone ||
            "Not available"
          }
          href={
            lead.phone
              ? `tel:${lead.phone}`
              : ""
          }
        />

        <ContactRow
          label="Email"
          value={
            lead.email ||
            "Not available"
          }
          href={
            lead.email
              ? `mailto:${lead.email}`
              : ""
          }
        />

        <ContactRow
          label="Website"
          value={
            getDomain(
              lead.website
            ) ||
            "Not available"
          }
          href={lead.website}
        />

        <ContactRow
          label="Address"
          value={
            lead.address ||
            lead.location ||
            "Not available"
          }
        />

        <ContactRow
          label="Priority"
          value={formatLabel(
            assignment?.priority ||
              "normal"
          )}
        />

        <ContactRow
          label="Last contact"
          value={
            assignment?.lastContactedAt
              ? formatDateTime(
                  assignment.lastContactedAt
                )
              : "No previous contact"
          }
        />

        <ContactRow
          label="Contact attempts"
          value={String(
            assignment?.callCount ||
              lead.callCount ||
              0
          )}
        />
      </div>
    </section>
  );
}

function AssignmentInstructions({
  assignment,
}) {
  return (
    <div className="rf-call-instructions">
      <div className="rf-call-instructions__header">
        <span>IN</span>

        <div>
          <strong>
            Manager instructions
          </strong>

          <p>
            Follow the assigned
            objective and record a
            complete outcome after the
            call.
          </p>
        </div>
      </div>

      <div className="rf-call-instructions__body">
        {assignment?.instructions ? (
          <p>
            {assignment.instructions}
          </p>
        ) : (
          <div className="rf-call-empty">
            <div>IN</div>

            <strong>
              No instructions provided
            </strong>

            <p>
              Use the mini audit findings
              to guide the conversation.
            </p>
          </div>
        )}

        {assignment?.dueAt ? (
          <ContactRow
            label="Assignment due"
            value={formatDateTime(
              assignment.dueAt
            )}
          />
        ) : null}

        {assignment?.nextActionAt ? (
          <ContactRow
            label="Scheduled follow-up"
            value={formatDateTime(
              assignment.nextActionAt
            )}
          />
        ) : null}
      </div>
    </div>
  );
}

function PanelHeader({
  title,
  subtitle,
}) {
  return (
    <header className="rf-call-panel-header">
      <h2>{title}</h2>
      <p>{subtitle}</p>
    </header>
  );
}

function LeadAvatar({
  lead = {},
  large = false,
  extraLarge = false,
}) {
  const classNames = [
    "rf-call-avatar",
    large
      ? "rf-call-avatar--large"
      : "",
    extraLarge
      ? "rf-call-avatar--extra-large"
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span className={classNames}>
      <b>
        {getInitials(
          lead.business ||
            lead.name ||
            "Lead"
        )}
      </b>
    </span>
  );
}

function AssignmentBadge({
  assignment,
}) {
  if (!assignment) {
    return (
      <span className="rf-call-assignment-badge">
        Direct lead
      </span>
    );
  }

  return (
    <span className="rf-call-assignment-badge">
      {formatLabel(
        assignment.status ||
          "assigned"
      )}
      {assignment.priority
        ? ` · ${formatLabel(
            assignment.priority
          )}`
        : ""}
    </span>
  );
}

function CallStatusBadge({
  status,
}) {
  const normalized =
    normalizeCallStatus(
      status || "idle"
    );

  return (
    <span
      className={`rf-call-status rf-call-status--${normalized}`}
    >
      <i />
      {formatLabel(normalized)}
    </span>
  );
}

function ContactRow({
  label,
  value,
  href,
}) {
  return (
    <div className="rf-call-contact-row">
      <span>{label}</span>

      {href ? (
        <a
          href={normalizeExternalUrl(
            href
          )}
          target={
            href.startsWith("http")
              ? "_blank"
              : undefined
          }
          rel={
            href.startsWith("http")
              ? "noreferrer"
              : undefined
          }
        >
          {value}
        </a>
      ) : (
        <strong>{value}</strong>
      )}
    </div>
  );
}

function WorkspaceAlert({
  type,
  message,
  onClose,
}) {
  return (
    <div
      className={`rf-call-alert rf-call-alert--${type}`}
    >
      <span>{safeCallWorkspaceMessage(message)}</span>

      <button
        type="button"
        onClick={onClose}
      >
        Close
      </button>
    </div>
  );
}

function CallWorkspaceSkeleton() {
  return (
    <main className="rf-call-workspace rf-call-workspace-v7">
      <CallWorkspaceLegacyV7Styles />
      <div className="rf-call-skeleton-header" />

      <section className="rf-call-skeleton-layout">
        <div>
          <div />
          <div />
          <div />
        </div>

        <aside>
          <div />
          <div />
        </aside>
      </section>
    </main>
  );
}

function createRequestId() {
  if (
    typeof globalThis.crypto?.randomUUID ===
    "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `call-${Date.now()}-${Math.random()
    .toString(16)
    .slice(2)}`;
}

function normalizeCallStatus(
  value
) {
  const status =
    normalizeStatus(value);

  if (
    [
      "started",
      "created",
      "queued",
      "initiated",
    ].includes(status)
  ) {
    return "connecting";
  }

  if (
    [
      "in_progress",
      "answered",
    ].includes(status)
  ) {
    return "connected";
  }

  if (
    [
      "ended",
      "complete",
    ].includes(status)
  ) {
    return "completed";
  }

  return status || "idle";
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function mapOutcomeToAssignmentStatus(
  outcome
) {
  const normalized =
    normalizeStatus(outcome);

  if (
    normalized ===
    "meeting_booked"
  ) {
    return "meeting_booked";
  }

  if (
    normalized ===
      "qualified" ||
    normalized ===
      "interested"
  ) {
    return "qualified";
  }

  if (
    normalized ===
    "follow_up"
  ) {
    return "follow_up";
  }

  if (
    normalized ===
    "do_not_contact"
  ) {
    return "do_not_contact";
  }

  if (
    normalized ===
      "not_interested" ||
    normalized ===
      "wrong_number"
  ) {
    return "completed";
  }

  return "in_progress";
}

function formatLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

function formatDuration(
  seconds
) {
  const total = Math.max(
    0,
    Number(seconds || 0)
  );

  const hours = Math.floor(
    total / 3600
  );

  const minutes = Math.floor(
    (total % 3600) / 60
  );

  const remainingSeconds =
    Math.floor(total % 60);

  if (hours > 0) {
    return [
      String(hours).padStart(
        2,
        "0"
      ),
      String(minutes).padStart(
        2,
        "0"
      ),
      String(
        remainingSeconds
      ).padStart(2, "0"),
    ].join(":");
  }

  return [
    String(minutes).padStart(
      2,
      "0"
    ),
    String(
      remainingSeconds
    ).padStart(2, "0"),
  ].join(":");
}

function formatTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
    }
  ).format(date);
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}

function toLocalDateTimeInput(
  value
) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "";
  }

  const offset =
    date.getTimezoneOffset();

  return new Date(
    date.getTime() -
      offset * 60_000
  )
    .toISOString()
    .slice(0, 16);
}

function getDomain(value) {
  if (!value) {
    return "";
  }

  try {
    return new URL(
      /^https?:\/\//i.test(value)
        ? value
        : `https://${value}`
    ).hostname.replace(
      /^www\./,
      ""
    );
  } catch {
    return value;
  }
}

function normalizeExternalUrl(
  value
) {
  if (!value) {
    return "";
  }

  if (
    /^(tel:|mailto:|https?:\/\/)/i.test(
      value
    )
  ) {
    return value;
  }

  return `https://${value}`;
}

function getInitials(value) {
  const words = String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!words.length) {
    return "RF";
  }

  if (words.length === 1) {
    return words[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return `${words[0][0]}${
    words[words.length - 1][0]
  }`.toUpperCase();
}

function safeCallWorkspaceMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/\bWebRTC\b/gi, "browser calling");
}

function notifyCallWorkspace(
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
    typeof bridge[type] ===
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

function CallWorkspaceLegacyV7Styles() {
  return (
    <style>{`
      .rf-call-workspace-v7{
        --rfcw-card:#fff;
        --rfcw-soft:#f6f7f8;
        --rfcw-text:#191c1d;
        --rfcw-text2:#4d4c59;
        --rfcw-muted:#777784;
        --rfcw-line:#e2e4e7;
        --rfcw-primary:#4648d4;
        --rfcw-primary-dark:#393bbb;
        --rfcw-primary-soft:#e8e9ff;
        --rfcw-green:#087a51;
        --rfcw-green-soft:#e4f7ee;
        --rfcw-red:#ba1a1a;
        --rfcw-red-soft:#ffedeb;
        --rfcw-dark:#2e3132;
        --rfcw-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 52px;
        color:var(--rfcw-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfcwPageIn .24s var(--rfcw-ease);
      }

      .rf-call-workspace-v7 *,
      .rf-call-workspace-v7 *::before,
      .rf-call-workspace-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfcwPageIn{
        from{opacity:0;transform:translateY(5px)}
        to{opacity:1;transform:none}
      }

      @keyframes rfcwPulse{
        0%,100%{opacity:.42}
        50%{opacity:1}
      }

      .rf-call-workspace-v7 .rf-call-header{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:18px;
        padding:0 0 16px;
        margin-bottom:12px;
        border-bottom:1px solid var(--rfcw-line);
      }

      .rf-call-workspace-v7 .rf-call-header__identity{
        min-width:0;
      }

      .rf-call-workspace-v7 .rf-call-eyebrow{
        margin:0 0 4px;
        color:var(--rfcw-primary);
        font-size:8px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rf-call-workspace-v7 .rf-call-header h1{
        margin:0;
        font:600 30px/38px Geist,Inter,sans-serif;
        letter-spacing:-.028em;
      }

      .rf-call-workspace-v7 .rf-call-header p{
        max-width:760px;
        margin:5px 0 0;
        color:var(--rfcw-text2);
        font-size:10px;
        line-height:16px;
      }

      .rf-call-workspace-v7 .rf-call-header__actions{
        display:flex;
        flex-wrap:wrap;
        gap:7px;
      }

      .rf-call-workspace-v7 .rf-call-button{
        min-height:38px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 10px;
        color:var(--rfcw-text);
        background:#fff;
        border:1px solid var(--rfcw-line);
        border-radius:8px;
        cursor:pointer;
        font-size:7px;
        font-weight:750;
        transition:.14s var(--rfcw-ease);
      }

      .rf-call-workspace-v7 .rf-call-button:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rf-call-workspace-v7 .rf-call-button:disabled{
        opacity:.44;
        cursor:not-allowed;
      }

      .rf-call-workspace-v7 .rf-call-button--primary{
        color:#fff;
        background:var(--rfcw-primary);
        border-color:var(--rfcw-primary);
        box-shadow:0 7px 16px rgba(70,72,212,.14);
      }

      .rf-call-workspace-v7 .rf-call-button--primary:hover:not(:disabled){
        background:var(--rfcw-primary-dark);
      }

      .rf-call-workspace-v7 .rf-call-button--danger{
        color:#fff;
        background:#b42318;
        border-color:#b42318;
      }

      .rf-call-workspace-v7 .rf-call-alert{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:10px 11px;
        margin-bottom:10px;
        border:1px solid;
        border-radius:9px;
        font-size:7px;
        line-height:12px;
        animation:rfcwPageIn .16s var(--rfcw-ease);
      }

      .rf-call-workspace-v7 .rf-call-alert--error{
        color:#7c1d1d;
        background:var(--rfcw-red-soft);
        border-color:#ffd0cc;
      }

      .rf-call-workspace-v7 .rf-call-alert--success{
        color:#086846;
        background:var(--rfcw-green-soft);
        border-color:#caeadb;
      }

      .rf-call-workspace-v7 .rf-call-alert button{
        min-height:28px;
        padding:4px 7px;
        color:inherit;
        background:#fff;
        border:1px solid currentColor;
        border-radius:6px;
        cursor:pointer;
        font-size:5.5px;
        font-weight:750;
      }

      .rf-call-workspace-v7 .rf-call-layout{
        display:grid;
        grid-template-columns:minmax(0,1.45fr) minmax(310px,.55fr);
        align-items:start;
        gap:11px;
      }

      .rf-call-workspace-v7 .rf-call-layout__primary,
      .rf-call-workspace-v7 .rf-call-layout__secondary{
        min-width:0;
        display:grid;
        gap:11px;
      }

      .rf-call-workspace-v7 .rf-call-panel,
      .rf-call-workspace-v7 .rf-call-control-card,
      .rf-call-workspace-v7 .rf-call-contact-card,
      .rf-call-workspace-v7 .rf-call-information-panel,
      .rf-call-workspace-v7 .rf-call-instructions{
        min-width:0;
        background:#fff;
        border:1px solid var(--rfcw-line);
        border-radius:12px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rf-call-workspace-v7 .rf-call-panel,
      .rf-call-workspace-v7 .rf-call-control-card,
      .rf-call-workspace-v7 .rf-call-contact-card,
      .rf-call-workspace-v7 .rf-call-information-panel{
        padding:14px;
      }

      .rf-call-workspace-v7 .rf-call-control-card{
        color:#fff;
        background:
          radial-gradient(circle at 90% 8%,rgba(82,85,223,.26),transparent 30%),
          #2e3132;
        border-color:rgba(255,255,255,.06);
      }

      .rf-call-workspace-v7 .rf-call-control-card h2,
      .rf-call-workspace-v7 .rf-call-control-card strong{
        color:#fff;
      }

      .rf-call-workspace-v7 .rf-call-control-card p,
      .rf-call-workspace-v7 .rf-call-control-card small{
        color:rgba(244,246,247,.64);
      }

      .rf-call-workspace-v7 .rf-call-control-card .rf-call-button--secondary{
        color:#fff;
        background:rgba(255,255,255,.08);
        border-color:rgba(255,255,255,.12);
      }

      .rf-call-workspace-v7 .rf-call-panel-header{
        padding-bottom:9px;
        margin-bottom:9px;
        border-bottom:1px solid #eff0f1;
      }

      .rf-call-workspace-v7 .rf-call-panel-header h2{
        margin:0;
        font:600 14px/19px Geist,Inter,sans-serif;
        letter-spacing:-.015em;
      }

      .rf-call-workspace-v7 .rf-call-panel-header p{
        margin:3px 0 0;
        color:var(--rfcw-muted);
        font-size:6px;
        line-height:10px;
      }

      .rf-call-workspace-v7 .rf-call-live-status{
        display:inline-flex;
        align-items:center;
        gap:5px;
        width:max-content;
        padding:5px 7px;
        color:#d7ffed;
        background:rgba(8,122,81,.22);
        border:1px solid rgba(184,237,214,.15);
        border-radius:999px;
        font-size:5.5px;
        font-weight:750;
      }

      .rf-call-workspace-v7 .rf-call-live-status::before{
        content:"";
        width:6px;
        height:6px;
        background:#65d7a8;
        border-radius:50%;
        animation:rfcwPulse 1.1s infinite ease-in-out;
      }

      .rf-call-workspace-v7 .rf-call-outcome-grid{
        display:grid;
        grid-template-columns:1fr 1fr;
        gap:7px;
      }

      .rf-call-workspace-v7 .rf-call-field{
        display:grid;
        gap:4px;
      }

      .rf-call-workspace-v7 .rf-call-field--wide{
        grid-column:1/-1;
      }

      .rf-call-workspace-v7 .rf-call-field > span{
        color:var(--rfcw-muted);
        font-size:5.5px;
        font-weight:750;
        text-transform:uppercase;
      }

      .rf-call-workspace-v7 input,
      .rf-call-workspace-v7 select,
      .rf-call-workspace-v7 textarea{
        width:100%;
        min-height:38px;
        padding:8px 9px;
        color:var(--rfcw-text);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
        outline:0;
        font:400 7px/12px Inter,sans-serif;
      }

      .rf-call-workspace-v7 textarea{
        min-height:90px;
        resize:vertical;
      }

      .rf-call-workspace-v7 input:focus,
      .rf-call-workspace-v7 select:focus,
      .rf-call-workspace-v7 textarea:focus{
        background:#fff;
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rf-call-workspace-v7 .rf-call-tabs{
        display:flex;
        gap:4px;
        overflow-x:auto;
        padding:4px;
        background:#f2f3f4;
        border-radius:8px;
        scrollbar-width:none;
      }

      .rf-call-workspace-v7 .rf-call-tabs::-webkit-scrollbar{
        display:none;
      }

      .rf-call-workspace-v7 .rf-call-tabs button{
        min-height:32px;
        flex:0 0 auto;
        padding:5px 7px;
        color:var(--rfcw-text2);
        background:transparent;
        border:0;
        border-radius:6px;
        cursor:pointer;
        font-size:5.8px;
        font-weight:750;
      }

      .rf-call-workspace-v7 .rf-call-tabs button.active,
      .rf-call-workspace-v7 .rf-call-tabs button[aria-selected="true"]{
        color:var(--rfcw-primary);
        background:#fff;
        box-shadow:0 1px 3px rgba(25,28,29,.06);
      }

      .rf-call-workspace-v7 .rf-call-contact-list,
      .rf-call-workspace-v7 .rf-call-history-list{
        display:grid;
        gap:5px;
      }

      .rf-call-workspace-v7 .rf-call-contact-row,
      .rf-call-workspace-v7 .rf-call-history-item{
        min-height:54px;
        display:grid;
        align-items:center;
        gap:7px;
        padding:8px;
        background:#f7f8f9;
        border-radius:8px;
      }

      .rf-call-workspace-v7 .rf-call-history-item{
        grid-template-columns:34px minmax(0,1fr) auto;
      }

      .rf-call-workspace-v7 .rf-call-history-icon{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        color:var(--rfcw-primary);
        background:#fff;
        border-radius:8px;
      }

      .rf-call-workspace-v7 .rf-call-instructions{
        overflow:hidden;
      }

      .rf-call-workspace-v7 .rf-call-instructions__header{
        padding:10px 12px;
        color:var(--rfcw-primary);
        background:var(--rfcw-primary-soft);
        border-bottom:1px solid #dcddff;
        font-size:6px;
        font-weight:800;
      }

      .rf-call-workspace-v7 .rf-call-instructions__body{
        padding:12px;
        color:var(--rfcw-text2);
        font-size:6.5px;
        line-height:11px;
      }

      .rf-call-workspace-v7 .rf-call-empty-state{
        min-height:390px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:7px;
        max-width:720px;
        margin:40px auto 0;
        padding:28px;
        text-align:center;
        background:#fff;
        border:1px solid var(--rfcw-line);
        border-radius:14px;
      }

      .rf-call-workspace-v7 .rf-call-empty-state > div{
        width:48px;
        height:48px;
        display:grid;
        place-items:center;
        color:var(--rfcw-primary);
        background:var(--rfcw-primary-soft);
        border-radius:12px;
        font-size:16px;
        font-weight:800;
      }

      .rf-call-workspace-v7 .rf-call-empty-state h1{
        margin:2px 0 0;
        font:600 20px/26px Geist,Inter,sans-serif;
      }

      .rf-call-workspace-v7 .rf-call-empty-state p{
        max-width:420px;
        margin:0;
        color:var(--rfcw-muted);
        font-size:7px;
        line-height:12px;
      }

      .rf-call-workspace-v7 .rf-call-empty-state a{
        margin-top:6px;
        color:var(--rfcw-primary);
        font-size:7px;
        font-weight:750;
        text-decoration:none;
      }

      .rf-call-workspace-v7 .rf-call-skeleton-header,
      .rf-call-workspace-v7 .rf-call-skeleton-layout > div > div,
      .rf-call-workspace-v7 .rf-call-skeleton-layout aside > div{
        background:linear-gradient(90deg,#eceef0,#f8f9fa,#eceef0);
        background-size:220% 100%;
        border-radius:10px;
        animation:rfcwPulse 1.15s infinite ease-in-out;
      }

      @media(max-width:1060px){
        .rf-call-workspace-v7{
          padding:22px;
        }

        .rf-call-workspace-v7 .rf-call-layout{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:680px){
        .rf-call-workspace-v7{
          padding:18px 12px 80px;
        }

        .rf-call-workspace-v7 .rf-call-header{
          align-items:flex-start;
          flex-direction:column;
        }

        .rf-call-workspace-v7 .rf-call-header h1{
          font-size:24px;
          line-height:31px;
        }

        .rf-call-workspace-v7 .rf-call-header__actions{
          display:grid;
          grid-template-columns:1fr;
          width:100%;
        }

        .rf-call-workspace-v7 .rf-call-header__actions .rf-call-button{
          width:100%;
        }

        .rf-call-workspace-v7 .rf-call-outcome-grid{
          grid-template-columns:1fr;
        }

        .rf-call-workspace-v7 .rf-call-field--wide{
          grid-column:auto;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-call-workspace-v7,
        .rf-call-workspace-v7 *,
        .rf-call-workspace-v7 *::before,
        .rf-call-workspace-v7 *::after{
          animation:none!important;
          transition-duration:.01ms!important;
        }
      }
    `}</style>
  );
}
