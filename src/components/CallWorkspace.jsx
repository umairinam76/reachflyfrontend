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
      <main className="rf-call-workspace">
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
    <main className="rf-call-workspace">
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
      <span>{message}</span>

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
    <main className="rf-call-workspace">
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