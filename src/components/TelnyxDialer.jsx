import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "../api";
import "./TelnyxDialer.css";

const ACTIVE_STATES = new Set([
  "active",
  "answered",
  "held",
  "recording",
]);

const RINGING_STATES = new Set([
  "new",
  "requesting",
  "trying",
  "calling",
  "early",
  "ringing",
]);

const FINAL_STATES = new Set([
  "hangup",
  "destroy",
  "destroyed",
  "purge",
  "ended",
  "completed",
  "failed",
]);

export default function TelnyxDialer({
  lead,
  assignmentId = "",
  campaignId = "",

  /**
   * Called immediately whenever the caller-queue assignment changes.
   *
   * Example:
   * - assigned -> calling
   * - calling -> contacted
   * - calling -> no_answer
   */
  onAssignmentChange,

  /**
   * Called after both the Telnyx call and caller-queue call are completed.
   *
   * The parent should remove the completed record and load the next lead.
   */
  onCallComplete,

  /**
   * Optional callback for opening the next eligible lead automatically.
   */
  onOpenNextLead,

  /**
   * Automatically proceed to the next lead after call completion.
   */
  autoAdvance = true,

  /**
   * Delay before moving to the next lead, allowing the caller to see
   * the final call status briefly.
   */
  autoAdvanceDelayMs = 900,
}) {
  const clientRef = useRef(null);
  const callRef = useRef(null);

  const localCallIdRef = useRef("");
  const providerCallIdRef = useRef("");
  const queueCallStartedRef = useRef(false);

  const startedAtRef = useRef(0);
  const answeredAtRef = useRef(0);

  const finalizingRef = useRef(false);
  const finalizedCallIdsRef = useRef(new Set());
  const mountedRef = useRef(true);

  const finalStateRef = useRef({
    cause: "",
    sipCode: 0,
    state: "",
  });

  const [status, setStatus] =
    useState("disconnected");

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [muted, setMuted] =
    useState(false);

  const [busy, setBusy] =
    useState(false);

  const [recordingConsent, setRecordingConsent] =
    useState(false);

  const [elapsed, setElapsed] =
    useState(0);

  const [currentAssignment, setCurrentAssignment] =
    useState(null);

  const [lastOutcome, setLastOutcome] =
    useState("");

  const resolvedAssignmentId =
    assignmentId ||
    lead?.assignmentId ||
    lead?.id ||
    "";

  const resolvedCampaignId =
    campaignId ||
    lead?.campaignId ||
    "";

  const phone = useMemo(
    () =>
      normalizePhone(
        lead?.phone ||
          lead?.internationalPhoneNumber ||
          lead?.nationalPhoneNumber ||
          ""
      ),
    [
      lead?.phone,
      lead?.internationalPhoneNumber,
      lead?.nationalPhoneNumber,
    ]
  );

  const callInProgress =
    Boolean(callRef.current) ||
    RINGING_STATES.has(status) ||
    ACTIVE_STATES.has(status);

  /**
   * Reset the dialer when the selected lead changes.
   */
  useEffect(() => {
    setError("");
    setMessage("");
    setElapsed(0);
    setMuted(false);
    setLastOutcome("");
    setCurrentAssignment(null);

    localCallIdRef.current = "";
    providerCallIdRef.current = "";
    queueCallStartedRef.current = false;
    startedAtRef.current = 0;
    answeredAtRef.current = 0;
    finalizingRef.current = false;

    finalStateRef.current = {
      cause: "",
      sipCode: 0,
      state: "",
    };
  }, [
    resolvedAssignmentId,
    lead?.id,
  ]);

  /**
   * Display a live duration after the call is answered.
   */
  useEffect(() => {
    if (
      !startedAtRef.current ||
      !ACTIVE_STATES.has(status)
    ) {
      return undefined;
    }

    const updateElapsed = () => {
      if (!mountedRef.current) {
        return;
      }

      setElapsed(
        Math.max(
          0,
          Math.floor(
            (
              Date.now() -
              startedAtRef.current
            ) / 1000
          )
        )
      );
    };

    updateElapsed();

    const timer =
      window.setInterval(
        updateElapsed,
        1000
      );

    return () => {
      window.clearInterval(timer);
    };
  }, [status]);

  const updateAssignmentState =
    useCallback(
      (assignment) => {
        if (!assignment) {
          return;
        }

        setCurrentAssignment(
          assignment
        );

        onAssignmentChange?.(
          assignment
        );
      },
      [onAssignmentChange]
    );

  const resetActiveCall =
    useCallback(() => {
      callRef.current = null;
      localCallIdRef.current = "";
      providerCallIdRef.current = "";

      queueCallStartedRef.current =
        false;

      startedAtRef.current = 0;
      answeredAtRef.current = 0;

      finalStateRef.current = {
        cause: "",
        sipCode: 0,
        state: "",
      };

      setElapsed(0);
      setMuted(false);
    }, []);

  const disconnect =
    useCallback(() => {
      try {
        callRef.current?.hangup?.();
      } catch {
        // Ignore cleanup errors.
      }

      try {
        clientRef.current?.disconnect?.();
      } catch {
        // Ignore cleanup errors.
      }

      callRef.current = null;
      clientRef.current = null;

      localCallIdRef.current = "";
      providerCallIdRef.current = "";

      startedAtRef.current = 0;
      answeredAtRef.current = 0;

      queueCallStartedRef.current =
        false;

      if (mountedRef.current) {
        setStatus("disconnected");
      }
    }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      disconnect();
    };
  }, [disconnect]);

  /**
   * Move to the next eligible caller-queue lead.
   */
  const advanceToNextLead =
    useCallback(
      async ({
        completedAssignment,
        completedCall,
        outcome,
      }) => {
        onCallComplete?.({
          assignment:
            completedAssignment ||
            null,

          call:
            completedCall ||
            null,

          outcome,
        });

        if (
          !autoAdvance ||
          !onOpenNextLead
        ) {
          return;
        }

        await delay(
          autoAdvanceDelayMs
        );

        if (!mountedRef.current) {
          return;
        }

        await onOpenNextLead({
          completedAssignment:
            completedAssignment ||
            null,

          completedCall:
            completedCall ||
            null,

          outcome,
        });
      },
      [
        autoAdvance,
        autoAdvanceDelayMs,
        onCallComplete,
        onOpenNextLead,
      ]
    );

  /**
   * Completes:
   *
   * 1. The local ReachFly Telnyx call record.
   * 2. The server-authoritative caller queue assignment.
   * 3. The parent screen refresh/auto-navigation.
   */
  const finalizeCall =
    useCallback(
      async ({
        state = "",
        cause = "",
        sipCode = 0,
        forceOutcome = "",
      } = {}) => {
        const localCallId =
          localCallIdRef.current;

        if (!localCallId) {
          resetActiveCall();

          if (mountedRef.current) {
            setStatus("ready");
          }

          return;
        }

        if (
          finalizingRef.current ||
          finalizedCallIdsRef.current.has(
            localCallId
          )
        ) {
          return;
        }

        finalizingRef.current = true;

        const durationSeconds =
          startedAtRef.current
            ? Math.max(
                0,
                Math.floor(
                  (
                    Date.now() -
                    startedAtRef.current
                  ) / 1000
                )
              )
            : 0;

        const wasAnswered =
          Boolean(
            answeredAtRef.current ||
              startedAtRef.current
          );

        const outcome =
          forceOutcome ||
          inferCallOutcome({
            state:
              state ||
              finalStateRef.current
                .state,

            cause:
              cause ||
              finalStateRef.current
                .cause,

            sipCode:
              Number(
                sipCode ||
                finalStateRef.current
                  .sipCode ||
                0
              ),

            wasAnswered,
            durationSeconds,
          });

        let completedTelnyxCall =
          null;

        let completedAssignment =
          null;

        try {
          /**
           * Complete the ReachFly Telnyx call record.
           */
          const telnyxResult =
            await api
              .completeTelnyxCall(
                localCallId,
                {
                  status:
                    outcome ===
                    "invalid_number"
                      ? "failed"
                      : "completed",

                  outcome,
                  disposition:
                    outcome,

                  durationSeconds,

                  cause:
                    cause ||
                    finalStateRef.current
                      .cause,

                  sipCode:
                    Number(
                      sipCode ||
                      finalStateRef.current
                        .sipCode ||
                      0
                    ),
                }
              )
              .catch(
                (requestError) => {
                  console.error(
                    "[TelnyxDialer] Could not complete Telnyx call record:",
                    requestError
                  );

                  return null;
                }
              );

          completedTelnyxCall =
            telnyxResult?.call ||
            null;

          /**
           * Complete the caller queue assignment.
           *
           * This is the important request that removes the lead from the
           * active/current queue and places it into the correct next bucket.
           */
          if (
            resolvedAssignmentId &&
            queueCallStartedRef.current
          ) {
            const queueResult =
              await api.callerQueueCallComplete(
                resolvedAssignmentId,
                {
                  callId:
                    localCallId,

                  providerCallId:
                    providerCallIdRef.current,

                  outcome,

                  status:
                    outcome,

                  durationSeconds,

                  answered:
                    wasAnswered,

                  cause:
                    cause ||
                    finalStateRef.current
                      .cause,

                  sipCode:
                    Number(
                      sipCode ||
                      finalStateRef.current
                        .sipCode ||
                      0
                    ),

                  notes:
                    buildAutomaticCallNote({
                      outcome,
                      durationSeconds,
                      cause:
                        cause ||
                        finalStateRef.current
                          .cause,
                      sipCode:
                        Number(
                          sipCode ||
                          finalStateRef
                            .current
                            .sipCode ||
                          0
                        ),
                    }),
                }
              );

            completedAssignment =
              queueResult?.assignment ||
              null;

            updateAssignmentState(
              completedAssignment
            );
          }

          finalizedCallIdsRef.current.add(
            localCallId
          );

          if (mountedRef.current) {
            setLastOutcome(
              outcome
            );

            setStatus(
              outcome ===
              "contacted"
                ? "completed"
                : outcome
            );

            setMessage(
              getOutcomeMessage(
                outcome
              )
            );
          }

          resetActiveCall();

          await advanceToNextLead({
            completedAssignment,
            completedCall:
              completedTelnyxCall,
            outcome,
          });

          if (
            mountedRef.current &&
            clientRef.current
          ) {
            setStatus("ready");
          }
        } catch (requestError) {
          console.error(
            "[TelnyxDialer] Finalization failed:",
            requestError
          );

          if (mountedRef.current) {
            setError(
              requestError?.message ||
                "The call ended, but the lead queue could not be updated."
            );

            setStatus(
              "completion_failed"
            );
          }
        } finally {
          finalizingRef.current =
            false;
        }
      },
      [
        advanceToNextLead,
        resetActiveCall,
        resolvedAssignmentId,
        updateAssignmentState,
      ]
    );

  const handleCallNotification =
    useCallback(
      async (notification) => {
        if (
          notification?.type !==
            "callUpdate" ||
          !notification.call
        ) {
          return;
        }

        const call =
          notification.call;

        callRef.current = call;

        const nextState =
          normalizeCallState(
            call.state ||
              notification.state ||
              ""
          );

        const ids =
          call.telnyxIDs ||
          call.telnyxIds ||
          {};

        const providerCallId =
          ids.call_leg_id ||
          ids.callLegId ||
          call.id ||
          "";

        providerCallIdRef.current =
          providerCallId;

        const cause =
          String(
            call.cause ||
              notification.cause ||
              ""
          );

        const sipCode =
          Number(
            call.sipCode ||
              call.sip_code ||
              notification.sipCode ||
              0
          ) || 0;

        finalStateRef.current = {
          state: nextState,
          cause,
          sipCode,
        };

        if (mountedRef.current) {
          setStatus(
            nextState ||
              "calling"
          );
        }

        const localCallId =
          localCallIdRef.current;

        if (localCallId) {
          /**
           * Link the browser SDK call IDs with the local ReachFly record.
           */
          api
            .linkTelnyxCall(
              localCallId,
              {
                providerCallId,

                callControlId:
                  ids.call_control_id ||
                  ids.callControlId ||
                  "",

                callSessionId:
                  ids.call_session_id ||
                  ids.callSessionId ||
                  "",

                state:
                  nextState,
              }
            )
            .catch(
              (requestError) => {
                console.warn(
                  "[TelnyxDialer] Call-link update failed:",
                  requestError
                );
              }
            );

          api
            .updateTelnyxCallState(
              localCallId,
              {
                state:
                  nextState,

                cause,
                sipCode,
              }
            )
            .catch(
              (requestError) => {
                console.warn(
                  "[TelnyxDialer] Client-state update failed:",
                  requestError
                );
              }
            );
        }

        if (
          ACTIVE_STATES.has(
            nextState
          )
        ) {
          if (
            !answeredAtRef.current
          ) {
            answeredAtRef.current =
              Date.now();
          }

          if (
            !startedAtRef.current
          ) {
            startedAtRef.current =
              Date.now();
          }
        }

        if (
          FINAL_STATES.has(
            nextState
          )
        ) {
          await finalizeCall({
            state:
              nextState,
            cause,
            sipCode,
          });
        }
      },
      [finalizeCall]
    );

  const connect =
    useCallback(async () => {
      if (clientRef.current) {
        return clientRef.current;
      }

      setBusy(true);
      setError("");
      setMessage("");
      setStatus("connecting");

      try {
        const [
          { TelnyxRTC },
          session,
        ] = await Promise.all([
          import(
            "@telnyx/webrtc"
          ),

          api.telnyxSession(),
        ]);

        if (!session?.loginToken) {
          throw new Error(
            "Telnyx did not return a browser login token."
          );
        }

        const client =
          new TelnyxRTC({
            login_token:
              session.loginToken,

            debug:
              false,

            enableCallReports:
              true,
          });

        client.remoteElement =
          "reachfly-telnyx-remote-audio";

        client.on(
          "telnyx.ready",
          () => {
            if (
              mountedRef.current
            ) {
              setStatus("ready");
              setError("");
            }
          }
        );

        client.on(
          "telnyx.error",
          (event) => {
            const message =
              event?.message ||
              event?.error?.message ||
              "Telnyx dialer error.";

            console.error(
              "[TelnyxDialer] Telnyx error:",
              event
            );

            if (
              mountedRef.current
            ) {
              setError(message);
              setStatus("failed");
            }
          }
        );

        client.on(
          "telnyx.notification",
          handleCallNotification
        );

        clientRef.current =
          client;

        await Promise.resolve(
          client.connect()
        );

        return client;
      } catch (requestError) {
        if (mountedRef.current) {
          setStatus("failed");

          setError(
            requestError?.message ||
              "Could not connect the Telnyx dialer."
          );
        }

        clientRef.current =
          null;

        throw requestError;
      } finally {
        if (mountedRef.current) {
          setBusy(false);
        }
      }
    }, [handleCallNotification]);

  const startCall =
    useCallback(async () => {
      if (!phone) {
        setError(
          "This lead does not have a valid phone number."
        );

        return;
      }

      if (
        !resolvedAssignmentId
      ) {
        setError(
          "This lead does not have a caller-queue assignment ID."
        );

        return;
      }

      if (
        !recordingConsent
      ) {
        setError(
          "Confirm that the approved recording disclosure has been given and consent obtained where required."
        );

        return;
      }

      if (
        callInProgress ||
        busy
      ) {
        return;
      }

      setBusy(true);
      setError("");
      setMessage("");
      setLastOutcome("");
      setStatus("connecting");

      try {
        const client =
          await connect();

        /**
         * First create a ReachFly Telnyx call record.
         *
         * This gives us a stable callId that is also recorded in the caller
         * queue timeline.
         */
        const created =
          await api.createTelnyxCall({
            toNumber:
              phone,

            leadId:
              lead?.id ||
              "",

            campaignId:
              resolvedCampaignId,

            assignmentId:
              resolvedAssignmentId,

            recordingConsent:
              true,

            recordingDisclosureVersion:
              "v1",
          });

        const createdCall =
          created?.call;

        if (!createdCall?.id) {
          throw new Error(
            "The server did not return a Telnyx call ID."
          );
        }

        localCallIdRef.current =
          createdCall.id;

        startedAtRef.current =
          0;

        answeredAtRef.current =
          0;

        setElapsed(0);

        /**
         * Immediately update the caller queue.
         *
         * The response you shared contains:
         *
         * status: "calling"
         * queueStatus: "in_call"
         *
         * We now apply that response to the visible UI immediately.
         */
        const queueStartResult =
          await api.callerQueueCallStart(
            resolvedAssignmentId,
            {
              callId:
                createdCall.id,

              provider:
                "telnyx",

              toNumber:
                phone,

              recordingConsent:
                true,
            }
          );

        queueCallStartedRef.current =
          true;

        updateAssignmentState(
          queueStartResult?.assignment
        );

        const telnyxCall =
          client.newCall({
            destinationNumber:
              phone,

            callerNumber:
              createdCall.fromNumber ||
              undefined,

            callerName:
              createdCall.callerName ||
              "ReachFly",

            audio: {
              echoCancellation:
                true,

              noiseSuppression:
                true,

              autoGainControl:
                true,
            },

            trickleIce:
              true,

            customHeaders:
              created.customHeaders ||
              [],
          });

        if (!telnyxCall) {
          throw new Error(
            "Telnyx could not create the browser call."
          );
        }

        callRef.current =
          telnyxCall;

        setStatus("calling");

        setMessage(
          `Calling ${
            lead?.business ||
            lead?.name ||
            phone
          }…`
        );
      } catch (requestError) {
        console.error(
          "[TelnyxDialer] Start call failed:",
          requestError
        );

        /**
         * Do not leave the assignment stuck in calling/in_call when browser
         * call creation fails after the queue-start request succeeded.
         */
        if (
          localCallIdRef.current &&
          queueCallStartedRef.current
        ) {
          await finalizeCall({
            state:
              "failed",

            cause:
              requestError?.message ||
              "Browser call startup failed",

            forceOutcome:
              "no_answer",
          }).catch(() => {});
        } else {
          resetActiveCall();
        }

        if (mountedRef.current) {
          setStatus("failed");

          setError(
            requestError?.message ||
              "The call could not be started."
          );
        }
      } finally {
        if (mountedRef.current) {
          setBusy(false);
        }
      }
    }, [
      busy,
      callInProgress,
      connect,
      finalizeCall,
      lead,
      phone,
      recordingConsent,
      resetActiveCall,
      resolvedAssignmentId,
      resolvedCampaignId,
      updateAssignmentState,
    ]);

  const hangup =
    useCallback(async () => {
      const call =
        callRef.current;

      if (!call) {
        return;
      }

      setBusy(true);
      setError("");
      setStatus("ending");

      try {
        await Promise.resolve(
          call.hangup?.()
        );

        /**
         * Telnyx normally sends a final callUpdate event. This fallback
         * prevents the UI from remaining stuck if that notification is lost.
         */
        window.setTimeout(
          () => {
            if (
              localCallIdRef.current &&
              !finalizingRef.current
            ) {
              void finalizeCall({
                state:
                  "hangup",

                cause:
                  "Caller ended call",
              });
            }
          },
          1200
        );
      } catch (requestError) {
        setError(
          requestError?.message ||
            "The call could not be ended."
        );

        await finalizeCall({
          state:
            "hangup",

          cause:
            requestError?.message ||
            "Caller ended call",
        });
      } finally {
        if (mountedRef.current) {
          setBusy(false);
        }
      }
    }, [finalizeCall]);

  const toggleMute =
    useCallback(() => {
      const call =
        callRef.current;

      if (!call) {
        return;
      }

      try {
        if (muted) {
          call.unmuteAudio?.();
        } else {
          call.muteAudio?.();
        }

        setMuted(
          (current) =>
            !current
        );
      } catch (requestError) {
        setError(
          requestError?.message ||
            "The mute setting could not be changed."
        );
      }
    }, [muted]);

  const assignmentStatus =
    currentAssignment?.status ||
    lead?.status ||
    "";

  const queueStatus =
    currentAssignment
      ?.queueStatus ||
    lead?.queueStatus ||
    "";

  return (
    <section className="cardish rf-telnyx-dialer">
      <audio
        id="reachfly-telnyx-remote-audio"
        autoPlay
        playsInline
      />

      <div className="section-title-row">
        <div>
          <span className="eyebrow">
            Telnyx dialer
          </span>

          <h3>
            {phone ||
              "No phone number"}
          </h3>

          <p>
            Status:{" "}
            <b>
              {formatLabel(
                status
              )}
            </b>

            {elapsed
              ? ` · ${formatDuration(
                  elapsed
                )}`
              : ""}
          </p>

          {assignmentStatus ? (
            <p className="text-xs text-muted">
              Lead:{" "}
              {formatLabel(
                assignmentStatus
              )}

              {queueStatus
                ? ` · Queue: ${formatLabel(
                    queueStatus
                  )}`
                : ""}
            </p>
          ) : null}
        </div>

        <span
          className={`badge badge-${getStatusBadge(
            status
          )}`}
        >
          {formatLabel(status)}
        </span>
      </div>

      {error ? (
        <p className="error-banner">
          {error}
        </p>
      ) : null}

      {message ? (
        <p className="success-banner">
          {message}
        </p>
      ) : null}

      {lastOutcome ? (
        <div className="rf-telnyx-result">
          <span>
            Latest outcome
          </span>

          <b>
            {formatLabel(
              lastOutcome
            )}
          </b>
        </div>
      ) : null}

      <label className="rf-assignment-option">
        <input
          type="checkbox"
          checked={
            recordingConsent
          }
          onChange={(
            event
          ) =>
            setRecordingConsent(
              event.target
                .checked
            )
          }
          disabled={
            callInProgress ||
            busy
          }
        />

        Approved recording disclosure has been given and consent obtained where required.
      </label>

      <div className="flex flex-gap flex-wrap mt16">
        {!callInProgress ? (
          <button
            className="btn primary"
            type="button"
            onClick={
              startCall
            }
            disabled={
              busy ||
              !phone ||
              !resolvedAssignmentId
            }
          >
            {busy
              ? "Connecting…"
              : "Call lead"}
          </button>
        ) : (
          <>
            <button
              className="btn light"
              type="button"
              onClick={
                toggleMute
              }
              disabled={
                busy
              }
            >
              {muted
                ? "Unmute"
                : "Mute"}
            </button>

            <button
              className="btn danger"
              type="button"
              onClick={
                hangup
              }
              disabled={
                busy
              }
            >
              {status ===
              "ending"
                ? "Ending…"
                : "End call"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

/* ==========================================================================
   Helpers
   ========================================================================== */

function normalizePhone(value) {
  const phone =
    String(value || "")
      .trim()
      .replace(/[^\d+]/g, "");

  if (!phone) {
    return "";
  }

  if (
    phone.startsWith("+")
  ) {
    return phone;
  }

  if (
    phone.startsWith("00")
  ) {
    return `+${phone.slice(
      2
    )}`;
  }

  if (
    phone.length === 10
  ) {
    return `+1${phone}`;
  }

  if (
    phone.length === 11 &&
    phone.startsWith("1")
  ) {
    return `+${phone}`;
  }

  return phone;
}

function normalizeCallState(value) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

function inferCallOutcome({
  state,
  cause,
  sipCode,
  wasAnswered,
  durationSeconds,
}) {
  const normalizedState =
    normalizeCallState(state);

  const normalizedCause =
    String(cause || "")
      .trim()
      .toLowerCase();

  const code =
    Number(sipCode || 0);

  if (
    code === 486 ||
    normalizedCause.includes(
      "busy"
    )
  ) {
    return "busy";
  }

  if (
    [
      404,
      410,
      484,
      604,
    ].includes(code) ||
    normalizedCause.includes(
      "invalid number"
    ) ||
    normalizedCause.includes(
      "unallocated"
    ) ||
    normalizedCause.includes(
      "not found"
    )
  ) {
    return "invalid_number";
  }

  if (
    normalizedCause.includes(
      "voicemail"
    )
  ) {
    return "voicemail";
  }

  if (
    wasAnswered ||
    durationSeconds > 0
  ) {
    return "contacted";
  }

  if (
    [
      408,
      480,
      487,
      603,
    ].includes(code) ||
    normalizedCause.includes(
      "no answer"
    ) ||
    normalizedCause.includes(
      "timeout"
    ) ||
    normalizedCause.includes(
      "cancel"
    ) ||
    normalizedState ===
      "failed"
  ) {
    return "no_answer";
  }

  return "no_answer";
}

function buildAutomaticCallNote({
  outcome,
  durationSeconds,
  cause,
  sipCode,
}) {
  const parts = [
    `Telnyx outcome: ${formatLabel(
      outcome
    )}`,

    `Duration: ${formatDuration(
      durationSeconds
    )}`,
  ];

  if (sipCode) {
    parts.push(
      `SIP: ${sipCode}`
    );
  }

  if (cause) {
    parts.push(
      `Cause: ${String(
        cause
      ).slice(0, 200)}`
    );
  }

  return parts.join(" · ");
}

function getOutcomeMessage(outcome) {
  const messages = {
    contacted:
      "Call completed. The lead has been marked as contacted.",

    no_answer:
      "No answer. The lead has been moved to the retry queue.",

    busy:
      "The number was busy. The lead has been moved to the retry queue.",

    voicemail:
      "Voicemail reached. The lead has been moved to follow-up.",

    invalid_number:
      "The phone number was invalid. The lead has been closed.",

    qualified:
      "The lead has been qualified.",

    meeting_booked:
      "A meeting has been booked.",

    converted:
      "The lead has been converted.",
  };

  return (
    messages[outcome] ||
    `Call completed with outcome: ${formatLabel(
      outcome
    )}.`
  );
}

function getStatusBadge(status) {
  if (
    ACTIVE_STATES.has(
      status
    ) ||
    status ===
      "completed"
  ) {
    return "green";
  }

  if (
    RINGING_STATES.has(
      status
    ) ||
    status ===
      "connecting" ||
    status ===
      "ending"
  ) {
    return "amber";
  }

  if (
    status ===
      "failed" ||
    status ===
      "completion_failed" ||
    status ===
      "invalid_number"
  ) {
    return "red";
  }

  return "gray";
}

function formatDuration(seconds) {
  const safeSeconds =
    Math.max(
      0,
      Number(seconds || 0)
    );

  const hours =
    Math.floor(
      safeSeconds / 3600
    );

  const minutes =
    Math.floor(
      (
        safeSeconds % 3600
      ) / 60
    );

  const remainder =
    safeSeconds % 60;

  if (hours) {
    return [
      hours,
      minutes,
      remainder,
    ]
      .map((value) =>
        String(value).padStart(
          2,
          "0"
        )
      )
      .join(":");
  }

  return `${String(
    minutes
  ).padStart(
    2,
    "0"
  )}:${String(
    remainder
  ).padStart(
    2,
    "0"
  )}`;
}

function formatLabel(value) {
  return String(
    value || "unknown"
  )
    .replace(/_/g, " ")
    .replace(
      /\b\w/g,
      (letter) =>
        letter.toUpperCase()
    );
}

function delay(milliseconds) {
  return new Promise(
    (resolve) => {
      window.setTimeout(
        resolve,
        Math.max(
          0,
          Number(
            milliseconds ||
            0
          )
        )
      );
    }
  );
}