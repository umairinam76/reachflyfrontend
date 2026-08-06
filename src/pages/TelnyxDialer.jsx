import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { apiRequest } from "../lib/workspace-platform-client.js";
import "../styles.css";

const api = {
  telnyxSession() {
    return apiRequest("/telnyx/session");
  },

  createTelnyxCall(body) {
    return apiRequest("/telnyx/calls", { method: "POST", body });
  },

  linkTelnyxCall(callId, body) {
    return apiRequest(`/telnyx/calls/${encodeURIComponent(callId)}/link`, {
      method: "PATCH",
      body,
    });
  },

  updateTelnyxCallState(callId, body) {
    return apiRequest(`/telnyx/calls/${encodeURIComponent(callId)}/state`, {
      method: "PATCH",
      body,
    });
  },

  completeTelnyxCall(callId, body) {
    return apiRequest(`/telnyx/calls/${encodeURIComponent(callId)}/complete`, {
      method: "PATCH",
      body,
    });
  },

  callerQueueCallStart(assignmentId, body) {
    return apiRequest(`/caller-queue/${encodeURIComponent(assignmentId)}/call/start`, {
      method: "POST",
      body,
    });
  },

  callerQueueCallComplete(assignmentId, body) {
    return apiRequest(`/caller-queue/${encodeURIComponent(assignmentId)}/call/complete`, {
      method: "POST",
      body,
    });
  },
};

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
  "initiated",
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

const CONNECTION_TIMEOUT_MS = 20_000;
const CALL_SETUP_TIMEOUT_SECONDS = 60;

export default function TelnyxDialer({
  lead,
  assignmentId = "",
  campaignId = "",
  onAssignmentChange,
  onCallComplete,
  onOpenNextLead,
  autoAdvance = true,
  autoAdvanceDelayMs = 900,
}) {
  const clientRef = useRef(null);
  const callRef = useRef(null);
  const microphoneStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const connectionPromiseRef = useRef(null);
  const sessionRef = useRef(null);
  const ringbackRef = useRef(null);

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

  const [
    recordingConsent,
    setRecordingConsent,
  ] = useState(false);

  const [elapsed, setElapsed] =
    useState(0);

  const [
    currentAssignment,
    setCurrentAssignment,
  ] = useState(null);

  const [lastOutcome, setLastOutcome] =
    useState("");

  const [
    microphonePermission,
    setMicrophonePermission,
  ] = useState("unknown");

  const resolvedAssignmentId =
    assignmentId ||
    lead?.assignmentId ||
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
    ACTIVE_STATES.has(status) ||
    status === "connecting" ||
    status === "ending";

  const updateAssignmentState =
    useCallback(
      (assignment) => {
        if (!assignment) {
          return;
        }

        setCurrentAssignment(assignment);
        onAssignmentChange?.(assignment);
      },
      [onAssignmentChange]
    );

  const stopMicrophone =
    useCallback(() => {
      const stream =
        microphoneStreamRef.current;

      if (stream) {
        for (const track of stream.getTracks()) {
          try {
            track.stop();
          } catch {
            // Ignore media cleanup errors.
          }
        }
      }

      microphoneStreamRef.current = null;
    }, []);

  const stopRingback =
    useCallback(() => {
      const ringback =
        ringbackRef.current;

      if (!ringback) {
        return;
      }

      ringback.stopped = true;

      if (ringback.timer) {
        window.clearTimeout(
          ringback.timer
        );
      }

      try {
        ringback.oscillator?.stop?.();
      } catch {
        // Oscillator may already be stopped.
      }

      try {
        ringback.context?.close?.();
      } catch {
        // Ignore audio-context cleanup errors.
      }

      ringbackRef.current = null;
    }, []);

  const startRingback =
    useCallback(() => {
      if (
        ringbackRef.current ||
        typeof window === "undefined"
      ) {
        return;
      }

      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      try {
        const context =
          new AudioContextClass();

        const ringback = {
          context,
          oscillator: null,
          timer: null,
          stopped: false,
        };

        ringbackRef.current = ringback;

        const playTone = () => {
          if (
            ringback.stopped ||
            ringbackRef.current !==
              ringback
          ) {
            return;
          }

          const oscillator =
            context.createOscillator();

          const gain =
            context.createGain();

          oscillator.type = "sine";
          oscillator.frequency.value =
            440;

          gain.gain.setValueAtTime(
            0.0001,
            context.currentTime
          );

          gain.gain.exponentialRampToValueAtTime(
            0.08,
            context.currentTime +
              0.03
          );

          gain.gain.setValueAtTime(
            0.08,
            context.currentTime +
              0.85
          );

          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            context.currentTime +
              0.95
          );

          oscillator.connect(gain);
          gain.connect(
            context.destination
          );

          oscillator.start();
          oscillator.stop(
            context.currentTime + 1
          );

          ringback.oscillator =
            oscillator;

          ringback.timer =
            window.setTimeout(
              playTone,
              3000
            );
        };

        void context
          .resume()
          .then(playTone)
          .catch(() => {
            stopRingback();
          });
      } catch {
        stopRingback();
      }
    }, [stopRingback]);

  const ensureRemoteAudio =
    useCallback(async () => {
      const element =
        remoteAudioRef.current;

      if (!element) {
        return;
      }

      element.autoplay = true;
      element.playsInline = true;
      element.muted = false;
      element.volume = 1;

      try {
        await element.play();
      } catch {
        /*
         * play() may reject before Telnyx has attached
         * the remote MediaStream. A later call-update
         * event will attempt playback again.
         */
      }
    }, []);

  const requestMicrophone =
    useCallback(async () => {
      if (
        typeof window === "undefined" ||
        !window.isSecureContext ||
        !navigator.mediaDevices ||
        typeof navigator.mediaDevices
          .getUserMedia !== "function"
      ) {
        const mediaError =
          new Error(
            "Microphone access requires HTTPS. Open ReachFly using an HTTPS URL, not http://10.11.22.21:5173."
          );

        mediaError.code =
          "INSECURE_MEDIA_CONTEXT";

        throw mediaError;
      }

      if (
        microphoneStreamRef.current
      ) {
        const activeTracks =
          microphoneStreamRef.current
            .getAudioTracks()
            .filter(
              (track) =>
                track.readyState ===
                "live"
            );

        if (activeTracks.length) {
          setMicrophonePermission(
            "granted"
          );

          return microphoneStreamRef.current;
        }
      }

      setMicrophonePermission(
        "requesting"
      );

      try {
        const stream =
          await navigator.mediaDevices.getUserMedia(
            {
              audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },

              video: false,
            }
          );

        const audioTracks =
          stream.getAudioTracks();

        if (!audioTracks.length) {
          for (const track of stream.getTracks()) {
            track.stop();
          }

          throw new Error(
            "No microphone audio track was returned."
          );
        }

        microphoneStreamRef.current =
          stream;

        setMicrophonePermission(
          "granted"
        );

        return stream;
      } catch (requestError) {
        setMicrophonePermission(
          "denied"
        );

        if (
          requestError?.name ===
            "NotAllowedError" ||
          requestError?.name ===
            "SecurityError"
        ) {
          throw new Error(
            "Microphone permission was denied. Allow microphone access in the browser site settings and try again."
          );
        }

        if (
          requestError?.name ===
            "NotFoundError" ||
          requestError?.name ===
            "DevicesNotFoundError"
        ) {
          throw new Error(
            "No microphone was found. Connect a microphone and try again."
          );
        }

        if (
          requestError?.name ===
            "NotReadableError" ||
          requestError?.name ===
            "TrackStartError"
        ) {
          throw new Error(
            "The microphone is already being used by another application or browser tab."
          );
        }

        if (
          requestError?.name ===
            "OverconstrainedError"
        ) {
          throw new Error(
            "The selected microphone does not support the requested audio settings."
          );
        }

        throw requestError;
      }
    }, []);

  const resetActiveCall =
    useCallback(() => {
      stopRingback();

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
    }, [stopRingback]);

  const disconnect =
    useCallback(async () => {
      stopRingback();

      try {
        await Promise.resolve(
          callRef.current?.hangup?.()
        );
      } catch {
        // Ignore active-call cleanup errors.
      }

      try {
        await Promise.resolve(
          clientRef.current?.disconnect?.()
        );
      } catch {
        // Ignore SDK cleanup errors.
      }

      callRef.current = null;
      clientRef.current = null;
      connectionPromiseRef.current =
        null;

      stopMicrophone();

      localCallIdRef.current = "";
      providerCallIdRef.current = "";
      queueCallStartedRef.current =
        false;

      startedAtRef.current = 0;
      answeredAtRef.current = 0;

      if (mountedRef.current) {
        setStatus("disconnected");
      }
    }, [
      stopMicrophone,
      stopRingback,
    ]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      void disconnect();
    };
  }, [disconnect]);

  useEffect(() => {
    setError("");
    setMessage("");
    setElapsed(0);
    setMuted(false);
    setLastOutcome("");
    setCurrentAssignment(null);

    resetActiveCall();
  }, [
    lead?.id,
    resolvedAssignmentId,
    resetActiveCall,
  ]);

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
            (Date.now() -
              startedAtRef.current) /
              1000
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

  const finalizeCall =
    useCallback(
      async ({
        state = "",
        cause = "",
        sipCode = 0,
        forceOutcome = "",
      } = {}) => {
        stopRingback();

        const localCallId =
          localCallIdRef.current;

        if (!localCallId) {
          resetActiveCall();

          if (mountedRef.current) {
            setStatus(
              clientRef.current
                ? "ready"
                : "disconnected"
            );
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
                  (Date.now() -
                    startedAtRef.current) /
                    1000
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
                  disposition: outcome,
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
                }
              )
              .catch(
                (requestError) => {
                  console.error(
                    "[TelnyxDialer] Could not complete call record:",
                    requestError
                  );

                  return null;
                }
              );

          completedTelnyxCall =
            telnyxResult?.call ||
            null;

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

                  provider:
                    "telnyx",

                  providerCallId:
                    providerCallIdRef.current,

                  outcome,
                  status: outcome,
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
                        finalStateRef
                          .current
                          .sipCode ||
                        0
                    ),

                  notes:
                    buildAutomaticCallNote({
                      outcome,
                      durationSeconds,

                      cause:
                        cause ||
                        finalStateRef
                          .current
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
            setLastOutcome(outcome);
            setStatus(outcome);

            setMessage(
              getOutcomeMessage(outcome)
            );
          }

          resetActiveCall();

          await advanceToNextLead({
            completedAssignment,
            completedCall:
              completedTelnyxCall,
            outcome,
          });

          if (mountedRef.current) {
            setStatus(
              clientRef.current
                ? "ready"
                : "disconnected"
            );
          }
        } catch (requestError) {
          console.error(
            "[TelnyxDialer] Finalization failed:",
            requestError
          );

          if (mountedRef.current) {
            setError(
              requestError?.message ||
                "The call ended, but its lead record could not be updated."
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
        stopRingback,
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

        if (
          RINGING_STATES.has(
            nextState
          )
        ) {
          startRingback();

          setMessage(
            `Ringing ${
              lead?.business ||
              lead?.name ||
              phone
            }…`
          );
        }

        if (
          ACTIVE_STATES.has(
            nextState
          )
        ) {
          stopRingback();

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

          setMessage(
            `Connected to ${
              lead?.business ||
              lead?.name ||
              phone
            }.`
          );

          await ensureRemoteAudio();
        }

        const localCallId =
          localCallIdRef.current;

        if (localCallId) {
          void api
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

                state: nextState,
              }
            )
            .catch(
              (requestError) => {
                console.warn(
                  "[TelnyxDialer] Call ID linking failed:",
                  requestError
                );
              }
            );

          void api
            .updateTelnyxCallState(
              localCallId,
              {
                state: nextState,
                cause,
                sipCode,
              }
            )
            .catch(
              (requestError) => {
                console.warn(
                  "[TelnyxDialer] Call state update failed:",
                  requestError
                );
              }
            );
        }

        if (
          FINAL_STATES.has(
            nextState
          )
        ) {
          stopRingback();

          await finalizeCall({
            state: nextState,
            cause,
            sipCode,
          });
        }
      },
      [
        ensureRemoteAudio,
        finalizeCall,
        lead?.business,
        lead?.name,
        phone,
        startRingback,
        stopRingback,
      ]
    );

  const connect =
    useCallback(async () => {
      if (
        clientRef.current &&
        status === "ready"
      ) {
        return clientRef.current;
      }

      if (
        connectionPromiseRef.current
      ) {
        return connectionPromiseRef.current;
      }

      const connectionPromise =
        (async () => {
          setError("");
          setMessage(
            "Connecting to Telnyx…"
          );
          setStatus("connecting");

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

          sessionRef.current = session;

          const client =
            new TelnyxRTC({
              login_token:
                session.loginToken,

              debug:
                import.meta.env.DEV,

              enableCallReports: true,

              mediaPermissionsRecovery: {
                enabled: true,
              },
            });

          const remoteAudio =
            remoteAudioRef.current;

          if (remoteAudio) {
            client.remoteElement =
              remoteAudio;
          } else {
            client.remoteElement =
              "reachfly-telnyx-remote-audio";
          }

          const readyPromise =
            new Promise(
              (resolve, reject) => {
                let settled = false;

                const timeout =
                  window.setTimeout(
                    () => {
                      if (settled) {
                        return;
                      }

                      settled = true;

                      reject(
                        new Error(
                          "Telnyx connection timed out. Check the network, WebRTC connection and Telnyx credentials."
                        )
                      );
                    },
                    CONNECTION_TIMEOUT_MS
                  );

                const resolveReady =
                  () => {
                    if (settled) {
                      return;
                    }

                    settled = true;
                    window.clearTimeout(
                      timeout
                    );

                    resolve(client);
                  };

                const rejectReady =
                  (event) => {
                    if (settled) {
                      return;
                    }

                    settled = true;
                    window.clearTimeout(
                      timeout
                    );

                    reject(
                      new Error(
                        getTelnyxErrorMessage(
                          event
                        )
                      )
                    );
                  };

                client.on(
                  "telnyx.ready",
                  resolveReady
                );

                client.on(
                  "telnyx.error",
                  rejectReady
                );
              }
            );

          client.on(
            "telnyx.notification",
            handleCallNotification
          );

          client.on(
            "telnyx.error",
            (event) => {
              console.error(
                "[TelnyxDialer] Telnyx error:",
                event
              );

              if (mountedRef.current) {
                setError(
                  getTelnyxErrorMessage(
                    event
                  )
                );
              }
            }
          );

          clientRef.current = client;

          await Promise.resolve(
            client.connect()
          );

          await readyPromise;

          if (mountedRef.current) {
            setStatus("ready");
            setMessage(
              "Telnyx dialer is ready."
            );
          }

          return client;
        })();

      connectionPromiseRef.current =
        connectionPromise;

      try {
        return await connectionPromise;
      } catch (requestError) {
        clientRef.current = null;

        if (mountedRef.current) {
          setStatus("failed");

          setError(
            requestError?.message ||
              "Could not connect to the Telnyx dialer."
          );
        }

        throw requestError;
      } finally {
        connectionPromiseRef.current =
          null;
      }
    }, [
      handleCallNotification,
      status,
    ]);

  const startCall =
    useCallback(async () => {
      if (!phone) {
        setError(
          "This lead does not have a valid phone number."
        );

        return;
      }

      if (!resolvedAssignmentId) {
        setError(
          "This lead does not have a caller-queue assignment ID."
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
      setMessage(
        "Requesting microphone access…"
      );
      setLastOutcome("");
      setStatus("requesting");

      try {
        /*
         * This deliberately runs inside the button click,
         * allowing the browser to display its permission prompt.
         */
        const microphoneStream =
          await requestMicrophone();

        const client =
          await connect();

        const shouldRecord =
          sessionRef.current?.recordingEnabled === true;

        if (shouldRecord && !recordingConsent) {
          throw new Error(
            "Confirm that the approved recording disclosure has been given and consent obtained where required."
          );
        }

        await ensureRemoteAudio();

        const created =
          await api.createTelnyxCall({
            toNumber: phone,

            leadId:
              lead?.id ||
              "",

            campaignId:
              resolvedCampaignId,

            assignmentId:
              resolvedAssignmentId,

            recordingConsent:
              shouldRecord && recordingConsent,

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

        startedAtRef.current = 0;
        answeredAtRef.current = 0;
        setElapsed(0);

        const queueStartResult =
          await api.callerQueueCallStart(
            resolvedAssignmentId,
            {
              callId:
                createdCall.id,

              provider: "telnyx",
              toNumber: phone,
              recordingConsent:
                shouldRecord && recordingConsent,
            }
          );

        queueCallStartedRef.current =
          true;

        updateAssignmentState(
          queueStartResult?.assignment
        );

        const remoteAudio =
          remoteAudioRef.current;

        const telnyxCall =
          client.newCall({
            destinationNumber: phone,

            callerNumber:
              sessionRef.current?.callerIdNumber ||
              createdCall.fromNumber ||
              undefined,

            callerName:
              createdCall.callerName ||
              "ReachFly",

            audio: true,

            localStream:
              microphoneStream,

            remoteElement:
              remoteAudio ||
              "reachfly-telnyx-remote-audio",

            trickleIce: true,

            timeoutSecs:
              CALL_SETUP_TIMEOUT_SECONDS,

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

        startRingback();
      } catch (requestError) {
        console.error(
          "[TelnyxDialer] Start call failed:",
          requestError
        );

        stopRingback();

        if (
          localCallIdRef.current &&
          queueCallStartedRef.current
        ) {
          await finalizeCall({
            state: "failed",

            cause:
              requestError?.message ||
              "Browser call startup failed",

            forceOutcome:
              "no_answer",
          }).catch(() => {});
        } else {
          resetActiveCall();
        }

        stopMicrophone();

        if (mountedRef.current) {
          setStatus("failed");

          setError(
            getTelnyxErrorMessage(
              requestError
            )
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
      ensureRemoteAudio,
      finalizeCall,
      lead?.business,
      lead?.id,
      lead?.name,
      phone,
      recordingConsent,
      requestMicrophone,
      resetActiveCall,
      resolvedAssignmentId,
      resolvedCampaignId,
      startRingback,
      stopMicrophone,
      stopRingback,
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
      stopRingback();

      try {
        await Promise.resolve(
          call.hangup?.()
        );

        window.setTimeout(
          () => {
            if (
              localCallIdRef.current &&
              !finalizingRef.current
            ) {
              void finalizeCall({
                state: "hangup",
                cause:
                  "Caller ended call",
              });
            }
          },
          1500
        );
      } catch (requestError) {
        await finalizeCall({
          state: "hangup",

          cause:
            requestError?.message ||
            "Caller ended call",
        });
      } finally {
        if (mountedRef.current) {
          setBusy(false);
        }
      }
    }, [
      finalizeCall,
      stopRingback,
    ]);

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

          for (
            const track
            of microphoneStreamRef
              .current?.getAudioTracks?.() ||
              []
          ) {
            track.enabled = true;
          }
        } else {
          call.muteAudio?.();

          for (
            const track
            of microphoneStreamRef
              .current?.getAudioTracks?.() ||
              []
          ) {
            track.enabled = false;
          }
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
    currentAssignment?.queueStatus ||
    lead?.queueStatus ||
    "";

  return (
    <section className="cardish rf-telnyx-dialer">
      <audio
        id="reachfly-telnyx-remote-audio"
        ref={remoteAudioRef}
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
              {formatLabel(status)}
            </b>

            {elapsed
              ? ` · ${formatDuration(
                  elapsed
                )}`
              : ""}
          </p>

          <p className="text-xs text-muted">
            Microphone:{" "}
            {formatLabel(
              microphonePermission
            )}
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

      {!window.isSecureContext ? (
        <p className="error-banner">
          Browser calling requires HTTPS.
          This page is currently opened
          through an insecure HTTP address.
        </p>
      ) : null}

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
          <span>Latest outcome</span>

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
          onChange={(event) =>
            setRecordingConsent(
              event.target.checked
            )
          }
          disabled={
            callInProgress ||
            busy
          }
        />

        Approved recording disclosure
        has been given and consent
        obtained where required.
      </label>

      <div className="flex flex-gap flex-wrap mt16">
        {!callInProgress ? (
          <button
            className="btn primary"
            type="button"
            onClick={startCall}
            disabled={
              busy ||
              !phone ||
              !resolvedAssignmentId ||
              !window.isSecureContext
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
              disabled={busy}
            >
              {muted
                ? "Unmute"
                : "Mute"}
            </button>

            <button
              className="btn danger"
              type="button"
              onClick={hangup}
              disabled={busy}
            >
              {status === "ending"
                ? "Ending…"
                : "End call"}
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function normalizePhone(value) {
  const phone =
    String(value || "")
      .trim()
      .replace(/[^\d+]/g, "");

  if (!phone) {
    return "";
  }

  if (phone.startsWith("+")) {
    return phone;
  }

  if (phone.startsWith("00")) {
    return `+${phone.slice(2)}`;
  }

  if (phone.length === 10) {
    return `+1${phone}`;
  }

  if (
    phone.length === 11 &&
    phone.startsWith("1")
  ) {
    return `+${phone}`;
  }

  return `+${phone}`;
}

function normalizeCallState(value) {
  const state =
    String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

  if (
    state === "trying" ||
    state === "new"
  ) {
    return "initiated";
  }

  if (state === "early") {
    return "ringing";
  }

  return state;
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
    normalizedCause.includes("busy")
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
      "invalid"
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
    normalizedState === "failed"
  ) {
    return "no_answer";
  }

  return "no_answer";
}

function getTelnyxErrorMessage(
  value
) {
  const code =
    value?.code ||
    value?.error?.code ||
    value?.data?.code ||
    "";

  if (
    String(code) === "42001"
  ) {
    return "Microphone permission was denied. Enable microphone access in the browser and operating-system settings.";
  }

  if (
    String(code) === "42002"
  ) {
    return "No usable microphone was found.";
  }

  if (
    String(code) === "42003"
  ) {
    return "Telnyx could not access the microphone.";
  }

  return (
    value?.message ||
    value?.error?.message ||
    value?.data?.message ||
    "The Telnyx call could not be started."
  );
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
    ACTIVE_STATES.has(status) ||
    status === "completed" ||
    status === "contacted"
  ) {
    return "green";
  }

  if (
    RINGING_STATES.has(status) ||
    status === "connecting" ||
    status === "requesting" ||
    status === "ending"
  ) {
    return "amber";
  }

  if (
    status === "failed" ||
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
      (safeSeconds % 3600) /
        60
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
  ).padStart(2, "0")}:${String(
    remainder
  ).padStart(2, "0")}`;
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
  return new Promise((resolve) => {
    window.setTimeout(
      resolve,
      Math.max(
        0,
        Number(milliseconds || 0)
      )
    );
  });
}