import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "../api";
import { apiRequest } from "../lib/workspace-platform-client.js";
import "../styles.css";

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

/*
 * The Telnyx SDK is loaded from its official browser bundle instead of using
 * import("@telnyx/webrtc"). This keeps Vite/Rolldown from requiring the npm
 * package during the build.
 */
const TELNYX_WEBRTC_SCRIPT_ID = "reachfly-telnyx-webrtc-sdk";
const TELNYX_WEBRTC_CDN_URL =
  "https://unpkg.com/@telnyx/webrtc@2.26.4/lib/bundle.js";

let telnyxWebRtcLoaderPromise = null;

function getLoadedTelnyxRTC() {
  return (
    globalThis.TelnyxWebRTC?.TelnyxRTC ||
    globalThis.TelnyxRTC ||
    null
  );
}

function loadTelnyxRTC() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(
      new Error("Telnyx WebRTC can only be initialized in a browser.")
    );
  }

  const loadedConstructor = getLoadedTelnyxRTC();

  if (loadedConstructor) {
    return Promise.resolve(loadedConstructor);
  }

  if (telnyxWebRtcLoaderPromise) {
    return telnyxWebRtcLoaderPromise;
  }

  telnyxWebRtcLoaderPromise = new Promise((resolve, reject) => {
    const rejectLoad = (message) => {
      telnyxWebRtcLoaderPromise = null;
      reject(new Error(message));
    };

    const resolveLoadedSdk = () => {
      const TelnyxRTC = getLoadedTelnyxRTC();

      if (!TelnyxRTC) {
        rejectLoad(
          "The Telnyx WebRTC script loaded, but TelnyxRTC was not exposed by the browser bundle."
        );
        return;
      }

      resolve(TelnyxRTC);
    };

    const existingScript = document.getElementById(
      TELNYX_WEBRTC_SCRIPT_ID
    );

    if (existingScript) {
      if (existingScript.dataset.loaded === "true") {
        resolveLoadedSdk();
        return;
      }

      existingScript.addEventListener("load", resolveLoadedSdk, {
        once: true,
      });

      existingScript.addEventListener(
        "error",
        () =>
          rejectLoad(
            "The Telnyx WebRTC browser library could not be loaded."
          ),
        { once: true }
      );

      return;
    }

    const script = document.createElement("script");
    script.id = TELNYX_WEBRTC_SCRIPT_ID;
    script.src = TELNYX_WEBRTC_CDN_URL;
    script.async = true;
    script.crossOrigin = "anonymous";

    script.addEventListener(
      "load",
      () => {
        script.dataset.loaded = "true";
        resolveLoadedSdk();
      },
      { once: true }
    );

    script.addEventListener(
      "error",
      () => {
        script.remove();
        rejectLoad(
          "The Telnyx WebRTC browser library could not be loaded. Allow https://unpkg.com in your Content-Security-Policy and verify network access."
        );
      },
      { once: true }
    );

    document.head.appendChild(script);
  });

  return telnyxWebRtcLoaderPromise;
}

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
  const ringbackRef = useRef(null);
  const audioContextRef = useRef(null);

  const localCallIdRef = useRef("");
  const providerCallIdRef = useRef("");
  const queueCallStartedRef = useRef(false);

  const startedAtRef = useRef(0);
  const answeredAtRef = useRef(0);

  const finalizingRef = useRef(false);
  const finalizedCallIdsRef = useRef(new Set());
  const mountedRef = useRef(true);

  /*
   * Telnyx browser sessions are long-lived. Refresh auth in-place instead of
   * forcing the caller to reload the whole CRM when a WebRTC token expires.
   */
  const authRefreshPromiseRef = useRef(null);

  /*
   * Telnyx can emit a late "Failed to hang up cleanly" SDK error after the BYE
   * already succeeded. Keep a short grace period so that benign cleanup noise
   * does not appear as a red production error after a successful End call.
   */
  const terminationGraceUntilRef = useRef(0);

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

  const [dialPadOpen, setDialPadOpen] =
    useState(false);

  const [sendingDigit, setSendingDigit] =
    useState("");

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

  const standaloneMode =
    !lead &&
    !assignmentId;

  const [
    standaloneQueue,
    setStandaloneQueue,
  ] = useState([]);

  const [
    standaloneAssignment,
    setStandaloneAssignment,
  ] = useState(null);

  const [
    standaloneLoading,
    setStandaloneLoading,
  ] = useState(false);

  const [
    standaloneSearch,
    setStandaloneSearch,
  ] = useState("");

  const [
    recentCalls,
    setRecentCalls,
  ] = useState([]);

  const [
    dialMode,
    setDialMode,
  ] = useState(
    autoAdvance ? "power" : "manual"
  );

  const activeLead =
    lead ||
    standaloneAssignment?.lead ||
    null;

  const resolvedAssignmentId =
    assignmentId ||
    standaloneAssignment?.id ||
    activeLead?.assignmentId ||
    "";

  const resolvedCampaignId =
    campaignId ||
    standaloneAssignment?.campaignId ||
    activeLead?.campaignId ||
    "";

  const phone = useMemo(
    () =>
      normalizePhone(
        activeLead?.phone ||
          activeLead?.internationalPhoneNumber ||
          activeLead?.nationalPhoneNumber ||
          ""
      ),
    [
      activeLead?.phone,
      activeLead?.internationalPhoneNumber,
      activeLead?.nationalPhoneNumber,
    ]
  );

  const visibleStandaloneQueue =
    useMemo(() => {
      const query =
        standaloneSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return standaloneQueue;
      }

      return standaloneQueue.filter(
        (item) =>
          [
            item?.lead?.business,
            item?.lead?.name,
            item?.lead?.phone,
            item?.lead?.email,
            item?.campaignName,
            item?.status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(query)
      );
    }, [
      standaloneQueue,
      standaloneSearch,
    ]);

  useEffect(() => {
    if (!standaloneMode) {
      return undefined;
    }

    let cancelled = false;

    async function loadStandaloneQueue() {
      setStandaloneLoading(true);

      try {
        const response =
          await apiRequest(
            "/caller-queue?bucket=all&limit=250",
            {
              timeoutMs: 20_000,
            }
          );

        if (cancelled) {
          return;
        }

        const records =
          Array.isArray(response?.records)
            ? response.records
            : Array.isArray(response?.items)
              ? response.items
              : [];

        const callable =
          records.filter(
            (item) =>
              item?.lead &&
              normalizePhone(
                item.lead.phone ||
                  item.lead
                    .internationalPhoneNumber ||
                  item.lead
                    .nationalPhoneNumber ||
                  item.phone ||
                  ""
              )
          );

        setStandaloneQueue(
          callable
        );

        setStandaloneAssignment(
          (current) => {
            if (
              current?.id &&
              callable.some(
                (item) =>
                  item.id === current.id
              )
            ) {
              return current;
            }

            return callable[0] || null;
          }
        );
      } catch (requestError) {
        if (!cancelled) {
          setError(
            requestError?.message ||
              "The calling queue could not be loaded."
          );
        }
      } finally {
        if (!cancelled) {
          setStandaloneLoading(false);
        }
      }
    }

    void loadStandaloneQueue();

    return () => {
      cancelled = true;
    };
  }, [
    standaloneMode,
  ]);

  useEffect(() => {
    if (!activeLead?.id) {
      setRecentCalls([]);
      return undefined;
    }

    let cancelled = false;

    async function loadRecentCalls() {
      try {
        const response =
          await apiRequest(
            `/telnyx/calls?leadId=${encodeURIComponent(
              activeLead.id
            )}&limit=8`,
            {
              timeoutMs: 15_000,
            }
          );

        if (!cancelled) {
          setRecentCalls(
            Array.isArray(response?.calls)
              ? response.calls
              : []
          );
        }
      } catch {
        if (!cancelled) {
          setRecentCalls([]);
        }
      }
    }

    void loadRecentCalls();

    return () => {
      cancelled = true;
    };
  }, [
    activeLead?.id,
  ]);

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

  const getAudioContext =
    useCallback(() => {
      if (typeof window === "undefined") {
        return null;
      }

      const AudioContextClass =
        window.AudioContext ||
        window.webkitAudioContext;

      if (!AudioContextClass) {
        return null;
      }

      if (
        !audioContextRef.current ||
        audioContextRef.current.state === "closed"
      ) {
        audioContextRef.current =
          new AudioContextClass();
      }

      return audioContextRef.current;
    }, []);

  /*
   * Browsers may reject AudioContext.resume() when it runs after network
   * requests because the original button-click activation has expired.
   * Call this before the first await in startCall().
   */
  const unlockAudio =
    useCallback(async () => {
      const context =
        getAudioContext();

      if (!context) {
        return false;
      }

      try {
        if (context.state === "suspended") {
          await context.resume();
        }

        /*
         * Play an inaudible oscillator immediately so Chrome/Safari regard
         * the audio context as user-activated for later ringback playback.
         */
        const oscillator =
          context.createOscillator();

        const gain =
          context.createGain();

        gain.gain.setValueAtTime(
          0.00001,
          context.currentTime
        );

        oscillator.connect(gain);
        gain.connect(context.destination);

        oscillator.start();
        oscillator.stop(
          context.currentTime + 0.02
        );

        return context.state === "running";
      } catch (audioError) {
        console.warn(
          "[TelnyxDialer] Could not unlock browser audio:",
          audioError
        );

        return false;
      }
    }, [getAudioContext]);

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
        // The oscillator may already have ended.
      }

      /*
       * Keep the AudioContext alive. Closing it would require another browser
       * user gesture before the next call can play ringback.
       */
      ringbackRef.current = null;
    }, []);

  const startRingback =
    useCallback(async () => {
      if (
        ringbackRef.current ||
        typeof window === "undefined"
      ) {
        return;
      }

      const context =
        getAudioContext();

      if (!context) {
        return;
      }

      try {
        if (context.state === "suspended") {
          await context.resume();
        }

        const ringback = {
          context,
          oscillator: null,
          timer: null,
          stopped: false,
        };

        ringbackRef.current = ringback;

        /*
         * US-style ringback: 440 Hz + 480 Hz, two seconds on and four seconds
         * off. The tone is local UI feedback and stops as soon as Telnyx
         * reports an active/final call state.
         */
        const playTone = () => {
          if (
            ringback.stopped ||
            ringbackRef.current !== ringback
          ) {
            return;
          }

          const gain =
            context.createGain();

          const oscillatorA =
            context.createOscillator();

          const oscillatorB =
            context.createOscillator();

          oscillatorA.type = "sine";
          oscillatorB.type = "sine";
          oscillatorA.frequency.value = 440;
          oscillatorB.frequency.value = 480;

          const now = context.currentTime;

          gain.gain.setValueAtTime(
            0.0001,
            now
          );

          gain.gain.exponentialRampToValueAtTime(
            0.06,
            now + 0.03
          );

          gain.gain.setValueAtTime(
            0.06,
            now + 1.90
          );

          gain.gain.exponentialRampToValueAtTime(
            0.0001,
            now + 2.0
          );

          oscillatorA.connect(gain);
          oscillatorB.connect(gain);
          gain.connect(context.destination);

          oscillatorA.start(now);
          oscillatorB.start(now);
          oscillatorA.stop(now + 2.02);
          oscillatorB.stop(now + 2.02);

          ringback.oscillator = {
            stop() {
              try {
                oscillatorA.stop();
              } catch {}
              try {
                oscillatorB.stop();
              } catch {}
            },
          };

          ringback.timer =
            window.setTimeout(
              playTone,
              6000
            );
        };

        playTone();
      } catch (audioError) {
        console.warn(
          "[TelnyxDialer] Ringback audio could not start:",
          audioError
        );

        stopRingback();
      }
    }, [
      getAudioContext,
      stopRingback,
    ]);

  const ensureRemoteAudio =
    useCallback(() => {
      const element =
        remoteAudioRef.current;

      if (!element) {
        return;
      }

      element.autoplay = true;
      element.playsInline = true;
      element.muted = false;
      element.volume = 1;

      /*
       * Do not await play() before Telnyx attaches a MediaStream.
       *
       * In Chromium, play() on an empty media element can remain pending.
       * Awaiting it would freeze startCall() after the SDK becomes ready,
       * before POST /api/telnyx/calls and client.newCall() are executed.
       */
      try {
        const playback =
          element.play();

        playback?.catch?.(() => {
          /*
           * This is expected before the remote stream is attached. The
           * call-update handler invokes this again when media is available.
           */
        });
      } catch {
        // A later call-update event will retry playback.
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
      setDialPadOpen(false);
      setSendingDigit("");
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
    activeLead?.id,
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

        const shouldAdvance =
          dialMode === "power" &&
          (autoAdvance ||
            standaloneMode);

        if (!shouldAdvance) {
          return;
        }

        await delay(
          autoAdvanceDelayMs
        );

        if (!mountedRef.current) {
          return;
        }

        if (onOpenNextLead) {
          await onOpenNextLead({
            completedAssignment:
              completedAssignment ||
              null,

            completedCall:
              completedCall ||
              null,

            outcome,
          });

          return;
        }

        if (standaloneMode) {
          const currentId =
            resolvedAssignmentId;

          const currentIndex =
            standaloneQueue.findIndex(
              (item) =>
                item.id === currentId
            );

          const nextAssignment =
            standaloneQueue[
              currentIndex >= 0
                ? currentIndex + 1
                : 0
            ] ||
            standaloneQueue[0] ||
            null;

          if (nextAssignment) {
            setStandaloneAssignment(
              nextAssignment
            );

            void apiRequest(
              `/caller-queue/${encodeURIComponent(
                nextAssignment.id
              )}/open`,
              {
                method: "POST",
              }
            ).catch(() => {});
          }
        }
      },
      [
        autoAdvance,
        autoAdvanceDelayMs,
        dialMode,
        onCallComplete,
        onOpenNextLead,
        resolvedAssignmentId,
        standaloneMode,
        standaloneQueue,
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
              await apiRequest(
                `/caller-queue/${encodeURIComponent(
                  resolvedAssignmentId
                )}/call/complete`,
                {
                  method: "POST",
                  body: {
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
                  },
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
              activeLead?.business ||
              activeLead?.name ||
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
              activeLead?.business ||
              activeLead?.name ||
              phone
            }.`
          );

          ensureRemoteAudio();
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
          terminationGraceUntilRef.current =
            Date.now() + 15_000;

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
        activeLead?.business,
        activeLead?.name,
        phone,
        startRingback,
        stopRingback,
      ]
    );

  const refreshTelnyxAuthentication =
    useCallback(
      async (client) => {
        if (!client) {
          throw new Error(
            "The Telnyx browser client is not connected."
          );
        }

        if (
          authRefreshPromiseRef.current
        ) {
          return authRefreshPromiseRef.current;
        }

        const refreshPromise =
          (async () => {
            const session =
              await api.telnyxSession();

            if (!session?.loginToken) {
              throw new Error(
                "Telnyx did not return a refreshed browser login token."
              );
            }

            if (
              typeof client.login ===
              "function"
            ) {
              await Promise.resolve(
                client.login({
                  creds: {
                    login_token:
                      session.loginToken,
                  },
                })
              );
            } else if (
              typeof client.updateToken ===
              "function"
            ) {
              await Promise.resolve(
                client.updateToken(
                  session.loginToken
                )
              );
            } else {
              throw new Error(
                "This Telnyx WebRTC build cannot refresh authentication in-place. Reload the call workspace."
              );
            }

            if (mountedRef.current) {
              setError("");
              setMessage(
                "Calling session refreshed."
              );
            }

            return session;
          })();

        authRefreshPromiseRef.current =
          refreshPromise;

        try {
          return await refreshPromise;
        } finally {
          authRefreshPromiseRef.current =
            null;
        }
      },
      []
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
            "Connecting to calling service…"
          );
          setStatus("connecting");

          const [
            TelnyxRTC,
            session,
          ] = await Promise.all([
            loadTelnyxRTC(),
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
              const errorMessage =
                getTelnyxErrorMessage(
                  event
                );

              if (
                isTelnyxAuthError(
                  event
                )
              ) {
                console.warn(
                  "[TelnyxDialer] Telnyx authentication expired; refreshing session.",
                  event
                );

                void refreshTelnyxAuthentication(
                  client
                ).catch(
                  (requestError) => {
                    console.error(
                      "[TelnyxDialer] Telnyx authentication refresh failed:",
                      requestError
                    );

                    if (
                      mountedRef.current
                    ) {
                      setError(
                        requestError?.message ||
                          errorMessage
                      );
                    }
                  }
                );

                return;
              }

              if (
                Date.now() <
                  terminationGraceUntilRef.current &&
                isBenignTerminationError(
                  event
                )
              ) {
                console.info(
                  "[TelnyxDialer] Ignoring benign post-hangup SDK cleanup error:",
                  event
                );
                return;
              }

              console.error(
                "[TelnyxDialer] Telnyx error:",
                event
              );

              if (mountedRef.current) {
                setError(
                  errorMessage
                );
              }
            }
          );

          client.on(
            "telnyx.warning",
            (event) => {
              console.warn(
                "[TelnyxDialer] Telnyx warning:",
                event
              );

              if (
                isTelnyxTokenExpiringWarning(
                  event
                )
              ) {
                void refreshTelnyxAuthentication(
                  client
                ).catch(
                  (requestError) => {
                    console.warn(
                      "[TelnyxDialer] Proactive Telnyx token refresh failed:",
                      requestError
                    );
                  }
                );
              }
            }
          );

          client.on(
            "telnyx.socket.error",
            (event) => {
              console.error(
                "[TelnyxDialer] Telnyx signaling socket error:",
                event
              );
            }
          );

          client.on(
            "telnyx.socket.close",
            (event) => {
              console.warn(
                "[TelnyxDialer] Telnyx signaling socket closed:",
                event
              );
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
              "Business dialer is ready."
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
              "Could not connect to the Business dialer."
          );
        }

        throw requestError;
      } finally {
        connectionPromiseRef.current =
          null;
      }
    }, [
      handleCallNotification,
      refreshTelnyxAuthentication,
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

      if (!recordingConsent) {
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
      setMessage(
        "Requesting microphone access…"
      );
      setLastOutcome("");
      setStatus("requesting");

      try {
        /*
         * Unlock output audio synchronously from the button click. Without
         * this, browsers may silently block locally generated ringback after
         * the session/API requests finish.
         */
        const audioUnlocked =
          await unlockAudio();

        if (!audioUnlocked) {
          console.warn(
            "[TelnyxDialer] Browser output audio was not unlocked. Ringback may be silent."
          );
        }

        /*
         * This deliberately runs inside the button click,
         * allowing the browser to display its permission prompt.
         */
        console.info(
          "[TelnyxDialer] start:requesting-microphone"
        );

        const microphoneStream =
          await requestMicrophone();

        console.info(
          "[TelnyxDialer] start:microphone-ready"
        );

        const client =
          await connect();

        console.info(
          "[TelnyxDialer] start:sdk-ready"
        );

        /*
         * Prepare the element, but never block call startup waiting for
         * playback before Telnyx has attached the remote MediaStream.
         */
        ensureRemoteAudio();

        setMessage(
          "Creating call record…"
        );

        console.info(
          "[TelnyxDialer] start:creating-call-record"
        );

        const created =
          await api.createTelnyxCall({
            toNumber: phone,

            leadId:
              activeLead?.id ||
              "",

            campaignId:
              resolvedCampaignId,

            assignmentId:
              resolvedAssignmentId,

            recordingConsent: true,

            recordingDisclosureVersion:
              "v1",
          });

        console.info(
          "[TelnyxDialer] start:call-record-created",
          {
            callId:
              created?.call?.id ||
              "",
          }
        );

        const createdCall =
          created?.call;

        if (!createdCall?.id) {
          throw new Error(
            "The server did not return a call identifier."
          );
        }

        localCallIdRef.current =
          createdCall.id;

        startedAtRef.current = 0;
        answeredAtRef.current = 0;
        setElapsed(0);

        setMessage(
          "Starting queue call…"
        );

        console.info(
          "[TelnyxDialer] start:queue-call-start"
        );

        const queueStartResult =
          await apiRequest(
            `/caller-queue/${encodeURIComponent(
              resolvedAssignmentId
            )}/call/start`,
            {
              method: "POST",
              body: {
                callId:
                  createdCall.id,

                provider: "telnyx",
                toNumber: phone,
                recordingConsent: true,
              },
            }
          );

        queueCallStartedRef.current =
          true;

        updateAssignmentState(
          queueStartResult?.assignment
        );

        const remoteAudio =
          remoteAudioRef.current;

        setMessage(
          `Calling ${
            activeLead?.business ||
            activeLead?.name ||
            phone
          }…`
        );

        /*
         * Start local ringback before invoking newCall so the caller receives
         * immediate audible feedback. Telnyx call notifications keep it
         * running during trying/ringing and stop it on active/final states.
         */
        void startRingback();

        console.info(
          "[TelnyxDialer] start:calling-newCall",
          {
            destinationNumber:
              phone,
            callerNumber:
              createdCall.fromNumber ||
              "",
          }
        );

        const telnyxCall =
          client.newCall({
            destinationNumber: phone,

            callerNumber:
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

            /*
             * Current Telnyx SDKs dispatch call-scoped notifications before
             * the client-level fallback. Register here so ringing/active/
             * hangup states always reach this component.
             */
            onNotification:
              handleCallNotification,
          });

        if (!telnyxCall) {
          throw new Error(
            "The calling service could not create the browser call."
          );
        }

        callRef.current =
          telnyxCall;

        setStatus("calling");

        console.info(
          "[TelnyxDialer] start:newCall-created",
          {
            callId:
              telnyxCall.id ||
              "",
            state:
              telnyxCall.state ||
              "",
          }
        );
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
      activeLead?.business,
      activeLead?.id,
      activeLead?.name,
      phone,
      recordingConsent,
      requestMicrophone,
      resetActiveCall,
      resolvedAssignmentId,
      resolvedCampaignId,
      handleCallNotification,
      startRingback,
      stopMicrophone,
      stopRingback,
      unlockAudio,
      updateAssignmentState,
    ]);

  const hangup =
    useCallback(async () => {
      const call =
        callRef.current;

      const localCallId =
        localCallIdRef.current;

      if (!call && !localCallId) {
        return;
      }

      setBusy(true);
      setError("");
      setStatus("ending");
      setDialPadOpen(false);

      terminationGraceUntilRef.current =
        Date.now() + 15_000;

      stopRingback();

      let browserHangupSucceeded = false;
      let carrierHangupSucceeded = false;
      let browserError = null;
      let carrierError = null;

      /*
       * Primary path: terminate the WebRTC/SIP call from the Telnyx browser SDK.
       * Telnyx documents call.hangup() as the normal client-side BYE/cancel path.
       */
      if (call?.hangup) {
        try {
          await Promise.resolve(
            call.hangup()
          );

          browserHangupSucceeded = true;
        } catch (requestError) {
          browserError =
            requestError;

          console.warn(
            "[TelnyxDialer] Browser hangup failed; trying carrier fallback:",
            requestError
          );
        }
      }

      /*
       * Carrier-side safety path.
       *
       * The backend uses the stored Telnyx call_control_id and sends
       * POST /v2/calls/{call_control_id}/actions/hangup. Calling both paths is
       * intentional: the browser call may lose its WebSocket while the PSTN
       * call leg is still alive.
       */
      if (localCallId) {
        try {
          await apiRequest(
            `/telnyx/calls/${encodeURIComponent(
              localCallId
            )}/end`,
            {
              method: "POST",
            }
          );

          carrierHangupSucceeded = true;
        } catch (requestError) {
          carrierError =
            requestError;

          /*
           * It is common for the server fallback to arrive after the browser BYE
           * already ended the call. If the browser hangup succeeded, the fallback
           * error is informational and must not make the UI claim the hangup
           * failed.
           */
          if (browserHangupSucceeded) {
            console.info(
              "[TelnyxDialer] Carrier hangup fallback was not needed or could not run:",
              requestError
            );
          } else {
            console.error(
              "[TelnyxDialer] Carrier hangup fallback failed:",
              requestError
            );
          }
        }
      }

      if (
        !browserHangupSucceeded &&
        !carrierHangupSucceeded
      ) {
        if (mountedRef.current) {
          setStatus(
            call?.state
              ? normalizeCallState(
                  call.state
                )
              : "active"
          );

          setError(
            carrierError?.message ||
              browserError?.message ||
              "The call could not be ended. The Telnyx call leg is still active."
          );

          setBusy(false);
        }

        return;
      }

      /*
       * Normal SDK/webhook final-state events will call finalizeCall first.
       * This timer is only a UI/CRM safety cleanup after at least one real
       * termination command was accepted.
       */
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
        2500
      );

      if (mountedRef.current) {
        setMessage(
          "Ending call…"
        );

        setBusy(false);
      }
    }, [
      finalizeCall,
      stopRingback,
    ]);

  const sendDialPadDigit =
    useCallback(
      async (digit) => {
        const normalizedDigit =
          String(digit || "").trim();

        if (
          !/^[0-9*#]$/.test(
            normalizedDigit
          )
        ) {
          return;
        }

        if (
          !ACTIVE_STATES.has(
            status
          )
        ) {
          setError(
            "The dial pad is available after the call is answered."
          );
          return;
        }

        const call =
          callRef.current;

        const localCallId =
          localCallIdRef.current;

        setSendingDigit(
          normalizedDigit
        );
        setError("");

        let browserDtmfSucceeded = false;
        let browserError = null;

        /*
         * Primary path: send DTMF through the live Telnyx WebRTC call.
         *
         * Recent Telnyx builds expose call.sendDigits(), while older/current
         * browser bundles may expose call.dtmf(). Support both so production
         * callers are not tied to one SDK surface.
         */
        const browserDtmfMethods = [
          typeof call?.sendDigits ===
          "function"
            ? () =>
                call.sendDigits(
                  normalizedDigit
                )
            : null,

          typeof call?.dtmf ===
          "function"
            ? () =>
                call.dtmf(
                  normalizedDigit
                )
            : null,
        ].filter(Boolean);

        for (
          const sendBrowserDtmf
          of browserDtmfMethods
        ) {
          try {
            await Promise.resolve(
              sendBrowserDtmf()
            );

            browserDtmfSucceeded = true;
            break;
          } catch (requestError) {
            browserError =
              requestError;

            console.warn(
              "[TelnyxDialer] Browser DTMF method failed; trying next available path:",
              requestError
            );
          }
        }

        /*
         * Fallback only when the browser SDK could not send the digit.
         * Do not send through both paths on success or the IVR would receive the
         * same digit twice.
         */
        if (
          !browserDtmfSucceeded &&
          localCallId
        ) {
          try {
            await apiRequest(
              `/telnyx/calls/${encodeURIComponent(
                localCallId
              )}/dtmf`,
              {
                method: "POST",
                body: {
                  digits:
                    normalizedDigit,
                },
              }
            );

            browserDtmfSucceeded = true;
          } catch (requestError) {
            setError(
              requestError?.message ||
                browserError?.message ||
                "The keypad digit could not be sent."
            );
          }
        }

        if (
          !browserDtmfSucceeded &&
          !localCallId
        ) {
          setError(
            browserError?.message ||
              "The keypad digit could not be sent because the active call is not linked yet."
          );
        }

        if (
          browserDtmfSucceeded &&
          mountedRef.current
        ) {
          setMessage(
            `Sent ${normalizedDigit}`
          );
        }

        if (mountedRef.current) {
          window.setTimeout(
            () => {
              if (
                mountedRef.current
              ) {
                setSendingDigit("");
              }
            },
            180
          );
        }
      },
      [status]
    );

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
    activeLead?.status ||
    "";

  const queueStatus =
    currentAssignment?.queueStatus ||
    activeLead?.queueStatus ||
    "";

  const leadName =
    activeLead?.business ||
    activeLead?.companyName ||
    activeLead?.name ||
    "Select a lead";

  const leadContact =
    activeLead?.contactName ||
    activeLead?.decisionMaker ||
    "";

  const leadLocation =
    activeLead?.address ||
    activeLead?.location ||
    "";

  const leadEmail =
    activeLead?.email ||
    "";

  const leadWebsite =
    activeLead?.website ||
    activeLead?.domain ||
    "";

  const queueIndex =
    standaloneMode &&
    resolvedAssignmentId
      ? Math.max(
          0,
          standaloneQueue.findIndex(
            (item) =>
              item.id ===
              resolvedAssignmentId
          )
        )
      : -1;

  const chooseStandaloneAssignment =
    (assignment) => {
      if (
        !assignment ||
        callInProgress ||
        busy
      ) {
        return;
      }

      setStandaloneAssignment(
        assignment
      );

      setError("");
      setMessage("");
      setLastOutcome("");

      void apiRequest(
        `/caller-queue/${encodeURIComponent(
          assignment.id
        )}/open`,
        {
          method: "POST",
        }
      ).catch(() => {});
    };

  const openAiDialer = () => {
    if (
      typeof window ===
      "undefined"
    ) {
      return;
    }

    window.location.assign(
      "/app/voice-agent?tab=leads&view=dialer"
    );
  };

  return (
    <section className="rf-telnyx-dialer rf-business-dialer-v8">
      <TelnyxDialerV7Styles />

      <audio
        id="reachfly-telnyx-remote-audio"
        ref={remoteAudioRef}
        autoPlay
        playsInline
      />

      <header className="rfbd8-topbar">
        <div className="rfbd8-title">
          <span className="rfbd8-kicker">
            ReachFly Dialer
          </span>

          <h2>Calling workspace</h2>

          <p>
            Work the queue, call the
            current lead and keep the
            context visible without
            leaving the dialer.
          </p>
        </div>

        <div className="rfbd8-topbar-meta">
          <span
            className={`rfbd8-status ${
              getStatusBadge(status)
            }`}
          >
            <i />
            {formatLabel(status)}
          </span>

          <span className="rfbd8-mic">
            Mic{" "}
            <b>
              {formatLabel(
                microphonePermission
              )}
            </b>
          </span>
        </div>
      </header>

      {!window.isSecureContext ? (
        <div className="rfbd8-banner error">
          Browser calling requires HTTPS.
          Open ReachFly using its secure
          HTTPS URL before placing a call.
        </div>
      ) : null}

      {error ? (
        <div
          className="rfbd8-banner error"
          role="alert"
        >
          {safeCustomerMessage(error)}
        </div>
      ) : null}

      {message ? (
        <div
          className="rfbd8-banner success"
          role="status"
        >
          {safeCustomerMessage(message)}
        </div>
      ) : null}

      <div className="rfbd8-modebar">
        <div
          className="rfbd8-mode-tabs"
          role="tablist"
          aria-label="Dialer mode"
        >
          <button
            type="button"
            role="tab"
            aria-selected={
              dialMode === "manual"
            }
            className={
              dialMode === "manual"
                ? "active"
                : ""
            }
            onClick={() =>
              setDialMode("manual")
            }
            disabled={callInProgress}
          >
            Manual
            <small>
              Call one lead
            </small>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={
              dialMode === "power"
            }
            className={
              dialMode === "power"
                ? "active"
                : ""
            }
            onClick={() =>
              setDialMode("power")
            }
            disabled={callInProgress}
          >
            Power
            <small>
              Auto-open next
            </small>
          </button>

          <button
            type="button"
            role="tab"
            aria-selected={
              dialMode === "ai"
            }
            className={
              dialMode === "ai"
                ? "active"
                : ""
            }
            onClick={() =>
              setDialMode("ai")
            }
            disabled={callInProgress}
          >
            AI
            <small>
              Voice Agent
            </small>
          </button>
        </div>

        {standaloneMode ? (
          <span className="rfbd8-queue-progress">
            {standaloneLoading
              ? "Loading queue…"
              : standaloneQueue.length
                ? `${Math.min(
                    queueIndex + 1,
                    standaloneQueue.length
                  )} of ${standaloneQueue.length}`
                : "No callable leads"}
          </span>
        ) : null}
      </div>

      {dialMode === "ai" ? (
        <section className="rfbd8-ai-handoff">
          <span className="rfbd8-ai-mark">
            AI
          </span>

          <div>
            <strong>
              Use ReachFly AI Voice Agent
            </strong>

            <p>
              The AI dialer handles live
              qualification, objections,
              meeting booking and
              campaign-aware email
              follow-up.
            </p>
          </div>

          <button
            type="button"
            className="rfbd8-button primary"
            onClick={openAiDialer}
          >
            Open AI dialer
          </button>
        </section>
      ) : (
        <div
          className={`rfbd8-workspace ${
            standaloneMode
              ? ""
              : "embedded"
          }`}
        >
          {standaloneMode ? (
            <aside className="rfbd8-queue">
              <div className="rfbd8-panel-head">
                <div>
                  <span>Call queue</span>
                  <strong>
                    Leads to work
                  </strong>
                </div>

                <b>
                  {
                    visibleStandaloneQueue.length
                  }
                </b>
              </div>

              <label className="rfbd8-search">
                <span aria-hidden="true">
                  ⌕
                </span>

                <input
                  value={
                    standaloneSearch
                  }
                  onChange={(event) =>
                    setStandaloneSearch(
                      event.target.value
                    )
                  }
                  placeholder="Search queue…"
                />
              </label>

              <div className="rfbd8-queue-list">
                {visibleStandaloneQueue.length ? (
                  visibleStandaloneQueue.map(
                    (item) => {
                      const itemLead =
                        item.lead || {};

                      const selected =
                        item.id ===
                        resolvedAssignmentId;

                      return (
                        <button
                          key={item.id}
                          type="button"
                          className={`rfbd8-queue-item ${
                            selected
                              ? "active"
                              : ""
                          }`}
                          disabled={
                            callInProgress ||
                            busy
                          }
                          onClick={() =>
                            chooseStandaloneAssignment(
                              item
                            )
                          }
                        >
                          <span className="rfbd8-avatar">
                            {String(
                              itemLead.business ||
                                itemLead.name ||
                                "L"
                            )
                              .trim()
                              .slice(0, 1)
                              .toUpperCase()}
                          </span>

                          <span className="rfbd8-queue-copy">
                            <strong>
                              {itemLead.business ||
                                itemLead.name ||
                                "Unnamed lead"}
                            </strong>

                            <small>
                              {itemLead.phone ||
                                item.phone ||
                                "No phone"}
                            </small>

                            <em>
                              {item.campaignName ||
                                formatLabel(
                                  item.status ||
                                    "queued"
                                )}
                            </em>
                          </span>

                          <span
                            className="rfbd8-chevron"
                            aria-hidden="true"
                          >
                            ›
                          </span>
                        </button>
                      );
                    }
                  )
                ) : (
                  <div className="rfbd8-empty">
                    <strong>
                      No callable leads
                    </strong>

                    <span>
                      Add leads to a
                      campaign or assign
                      leads to the caller
                      queue first.
                    </span>
                  </div>
                )}
              </div>
            </aside>
          ) : null}

          <main className="rfbd8-console">
            <div className="rfbd8-call-card">
              <div className="rfbd8-lead-summary">
                <span className="rfbd8-avatar large">
                  {String(leadName)
                    .trim()
                    .slice(0, 1)
                    .toUpperCase()}
                </span>

                <div>
                  <span>
                    Current lead
                  </span>

                  <strong>
                    {leadName}
                  </strong>

                  {leadContact ? (
                    <small>
                      {leadContact}
                    </small>
                  ) : null}
                </div>
              </div>

              <div className="rfbd8-number">
                {phone ||
                  "No phone number"}
              </div>

              <div className="rfbd8-call-state">
                <span>
                  {callInProgress
                    ? formatLabel(status)
                    : "Ready to call"}
                </span>

                <strong>
                  {callInProgress
                    ? formatDuration(
                        elapsed
                      )
                    : "00:00"}
                </strong>
              </div>

              <div
                className={`rfbd8-keypad ${
                  callInProgress &&
                  !dialPadOpen
                    ? "collapsed"
                    : ""
                }`}
                aria-label="Call dial pad"
              >
                {[
                  "1",
                  "2",
                  "3",
                  "4",
                  "5",
                  "6",
                  "7",
                  "8",
                  "9",
                  "*",
                  "0",
                  "#",
                ].map((digit) => (
                  <button
                    key={digit}
                    type="button"
                    disabled={
                      busy ||
                      Boolean(
                        sendingDigit
                      ) ||
                      !ACTIVE_STATES.has(
                        status
                      )
                    }
                    onClick={() =>
                      void sendDialPadDigit(
                        digit
                      )
                    }
                    aria-label={`Send keypad digit ${digit}`}
                  >
                    {sendingDigit ===
                    digit
                      ? "•"
                      : digit}
                  </button>
                ))}
              </div>

              <div className="rfbd8-call-controls">
                {!callInProgress ? (
                  <button
                    className="rfbd8-call-button"
                    type="button"
                    onClick={startCall}
                    disabled={
                      busy ||
                      !phone ||
                      !resolvedAssignmentId ||
                      !window.isSecureContext
                    }
                  >
                    <span
                      aria-hidden="true"
                    >
                      ☎
                    </span>

                    {busy
                      ? "Connecting…"
                      : "Start call"}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      className={`rfbd8-round-control ${
                        muted
                          ? "active"
                          : ""
                      }`}
                      onClick={
                        toggleMute
                      }
                      disabled={busy}
                    >
                      <span
                        aria-hidden="true"
                      >
                        {muted
                          ? "🔇"
                          : "🎙"}
                      </span>

                      {muted
                        ? "Unmute"
                        : "Mute"}
                    </button>

                    <button
                      type="button"
                      className={`rfbd8-round-control ${
                        dialPadOpen
                          ? "active"
                          : ""
                      }`}
                      onClick={() =>
                        setDialPadOpen(
                          (current) =>
                            !current
                        )
                      }
                      disabled={
                        busy ||
                        !ACTIVE_STATES.has(
                          status
                        )
                      }
                    >
                      <span
                        aria-hidden="true"
                      >
                        ⌨
                      </span>
                      Keypad
                    </button>

                    <button
                      type="button"
                      className="rfbd8-end-button"
                      onClick={hangup}
                      disabled={busy}
                    >
                      <span
                        aria-hidden="true"
                      >
                        ☎
                      </span>

                      {status === "ending"
                        ? "Ending…"
                        : "End"}
                    </button>
                  </>
                )}
              </div>

              {lastOutcome ? (
                <div className="rfbd8-outcome">
                  <span>
                    Latest outcome
                  </span>

                  <strong>
                    {formatLabel(
                      lastOutcome
                    )}
                  </strong>
                </div>
              ) : null}
            </div>

            <label className="rfbd8-consent">
              <input
                type="checkbox"
                checked={
                  recordingConsent
                }
                onChange={(event) =>
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

              <span>
                <strong>
                  Recording disclosure
                  confirmed
                </strong>

                <small>
                  Confirm the approved
                  disclosure and consent
                  where required before
                  starting the call.
                </small>
              </span>
            </label>
          </main>

          <aside className="rfbd8-context">
            <div className="rfbd8-panel-head">
              <div>
                <span>Lead context</span>
                <strong>
                  What you need now
                </strong>
              </div>
            </div>

            <div className="rfbd8-context-card">
              <div className="rfbd8-context-title">
                <span className="rfbd8-avatar">
                  {String(leadName)
                    .trim()
                    .slice(0, 1)
                    .toUpperCase()}
                </span>

                <div>
                  <strong>
                    {leadName}
                  </strong>

                  <small>
                    {leadContact ||
                      "Business lead"}
                  </small>
                </div>
              </div>

              <ContextField
                label="Phone"
                value={
                  phone ||
                  "Unavailable"
                }
              />

              <ContextField
                label="Email"
                value={
                  leadEmail ||
                  "Unavailable"
                }
              />

              <ContextField
                label="Location"
                value={
                  leadLocation ||
                  "Unavailable"
                }
              />

              <ContextField
                label="Website"
                value={
                  leadWebsite ||
                  "Unavailable"
                }
              />

              {assignmentStatus ? (
                <ContextField
                  label="Lead status"
                  value={formatLabel(
                    assignmentStatus
                  )}
                />
              ) : null}

              {queueStatus ? (
                <ContextField
                  label="Queue"
                  value={formatLabel(
                    queueStatus
                  )}
                />
              ) : null}
            </div>

            <div className="rfbd8-history">
              <div className="rfbd8-history-head">
                <strong>
                  Recent calls
                </strong>

                <span>
                  {recentCalls.length}
                </span>
              </div>

              {recentCalls.length ? (
                recentCalls
                  .slice(0, 5)
                  .map((call) => (
                    <div
                      className="rfbd8-history-row"
                      key={
                        call.id ||
                        `${call.createdAt}-${call.status}`
                      }
                    >
                      <span>
                        {formatLabel(
                          call.outcome ||
                            call.status ||
                            "call"
                        )}
                      </span>

                      <small>
                        {formatDuration(
                          call.durationSeconds ||
                            0
                        )}
                      </small>
                    </div>
                  ))
              ) : (
                <p>
                  No recent call history
                  for this lead.
                </p>
              )}
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}

function ContextField({
  label,
  value,
}) {
  return (
    <div className="rfbd8-context-field">
      <span>{label}</span>
      <strong title={String(value)}>
        {value}
      </strong>
    </div>
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

function isTelnyxAuthError(
  value
) {
  const code =
    Number(
      value?.code ||
        value?.error?.code ||
        value?.data?.code ||
        0
    ) || 0;

  if (
    [
      46001,
      46002,
      46003,
    ].includes(code)
  ) {
    return true;
  }

  const message =
    getTelnyxErrorMessage(
      value
    )
      .toLowerCase();

  return (
    message.includes(
      "access token is no longer active"
    ) ||
    message.includes(
      "authentication required"
    ) ||
    message.includes(
      "invalid credentials"
    ) ||
    (
      message.includes("token") &&
      (
        message.includes(
          "expired"
        ) ||
        message.includes(
          "inactive"
        )
      )
    )
  );
}

function isTelnyxTokenExpiringWarning(
  value
) {
  const code =
    Number(
      value?.code ||
        value?.warning?.code ||
        value?.data?.code ||
        0
    ) || 0;

  if (code === 34001) {
    return true;
  }

  const message =
    String(
      value?.message ||
        value?.warning?.message ||
        value?.data?.message ||
        ""
    )
      .toLowerCase();

  return (
    message.includes("token") &&
    (
      message.includes(
        "expiring"
      ) ||
      message.includes(
        "expires soon"
      )
    )
  );
}

function isBenignTerminationError(
  value
) {
  const message =
    getTelnyxErrorMessage(
      value
    )
      .toLowerCase();

  return (
    message.includes(
      "failed to hang up cleanly"
    ) ||
    message.includes(
      "already hung up"
    ) ||
    message.includes(
      "already ended"
    ) ||
    message.includes(
      "call does not exist"
    ) ||
    message.includes(
      "call not found"
    )
  );
}

function buildAutomaticCallNote({
  outcome,
  durationSeconds,
  cause,
  sipCode,
}) {
  const parts = [
    `Business call outcome: ${formatLabel(
      outcome
    )}`,

    `Duration: ${formatDuration(
      durationSeconds
    )}`,
  ];

  if (sipCode) {
    parts.push(
      `Network code: ${sipCode}`
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

function safeCustomerMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bWebRTC\b/gi, "browser calling")
    .replace(/\bSIP\b/gi, "network")
    .replace(/https:\/\/unpkg\.com/gi, "the browser calling library host")
    .replace(/credentials/gi, "connection settings");
}

function TelnyxDialerV7Styles() {
  return (
    <style>{`
      .rf-business-dialer-v8{
        --rfbd8-text:#17191c;
        --rfbd8-soft:#5f6570;
        --rfbd8-muted:#858b96;
        --rfbd8-line:#e7e9ee;
        --rfbd8-surface:#ffffff;
        --rfbd8-surface2:#f7f8fb;
        --rfbd8-primary:#5154e8;
        --rfbd8-primary-soft:#efefff;
        --rfbd8-green:#0f9f6e;
        --rfbd8-green-dark:#087a54;
        --rfbd8-green-soft:#e7f8f1;
        --rfbd8-red:#d94848;
        --rfbd8-red-soft:#fff0f0;
        --rfbd8-amber:#b26a00;
        --rfbd8-amber-soft:#fff5df;
        --rfbd8-shadow:0 18px 50px rgba(20,24,40,.07);
        width:100%;
        display:grid;
        gap:14px;
        color:var(--rfbd8-text);
        font-family:Inter,Geist,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
      }

      .rf-business-dialer-v8 *,
      .rf-business-dialer-v8 *::before,
      .rf-business-dialer-v8 *::after{
        box-sizing:border-box;
      }

      .rf-business-dialer-v8 > audio{
        display:none;
      }

      .rfbd8-topbar{
        min-height:72px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:18px;
        padding:14px 16px;
        background:var(--rfbd8-surface);
        border:1px solid var(--rfbd8-line);
        border-radius:16px;
        box-shadow:0 8px 24px rgba(20,24,40,.035);
      }

      .rfbd8-title{
        min-width:0;
      }

      .rfbd8-kicker{
        display:block;
        margin-bottom:3px;
        color:var(--rfbd8-primary);
        font-size:11px;
        font-weight:800;
        letter-spacing:.08em;
        text-transform:uppercase;
      }

      .rfbd8-title h2{
        margin:0;
        font:700 20px/26px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rfbd8-title p{
        max-width:650px;
        margin:3px 0 0;
        color:var(--rfbd8-soft);
        font-size:12px;
        line-height:18px;
      }

      .rfbd8-topbar-meta{
        display:flex;
        align-items:center;
        gap:8px;
        flex-wrap:wrap;
        justify-content:flex-end;
      }

      .rfbd8-status,
      .rfbd8-mic{
        min-height:32px;
        display:inline-flex;
        align-items:center;
        gap:7px;
        padding:6px 10px;
        border:1px solid var(--rfbd8-line);
        border-radius:999px;
        background:#fff;
        color:var(--rfbd8-soft);
        font-size:11px;
        font-weight:700;
        white-space:nowrap;
      }

      .rfbd8-status i{
        width:7px;
        height:7px;
        border-radius:50%;
        background:#9ba0aa;
        box-shadow:0 0 0 4px rgba(155,160,170,.11);
      }

      .rfbd8-status.green i{
        background:var(--rfbd8-green);
        box-shadow:0 0 0 4px rgba(15,159,110,.12);
      }

      .rfbd8-status.amber i{
        background:#e1931d;
        box-shadow:0 0 0 4px rgba(225,147,29,.12);
      }

      .rfbd8-status.red i{
        background:var(--rfbd8-red);
        box-shadow:0 0 0 4px rgba(217,72,72,.12);
      }

      .rfbd8-mic b{
        color:var(--rfbd8-text);
      }

      .rfbd8-banner{
        padding:10px 13px;
        border-radius:12px;
        border:1px solid;
        font-size:12px;
        line-height:18px;
      }

      .rfbd8-banner.error{
        color:#932d2d;
        background:var(--rfbd8-red-soft);
        border-color:#ffd1d1;
      }

      .rfbd8-banner.success{
        color:#096344;
        background:var(--rfbd8-green-soft);
        border-color:#c8ecdd;
      }

      .rfbd8-modebar{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
      }

      .rfbd8-mode-tabs{
        display:inline-flex;
        gap:4px;
        padding:4px;
        background:#eef0f4;
        border-radius:12px;
      }

      .rfbd8-mode-tabs button{
        min-width:104px;
        min-height:44px;
        display:grid;
        align-content:center;
        gap:1px;
        padding:6px 12px;
        color:#5b616b;
        background:transparent;
        border:0;
        border-radius:9px;
        cursor:pointer;
        font-size:12px;
        font-weight:800;
        transition:background .15s ease,color .15s ease,box-shadow .15s ease;
      }

      .rfbd8-mode-tabs button small{
        color:#9297a0;
        font-size:9px;
        font-weight:600;
      }

      .rfbd8-mode-tabs button.active{
        color:var(--rfbd8-text);
        background:#fff;
        box-shadow:0 2px 8px rgba(20,24,40,.08);
      }

      .rfbd8-mode-tabs button.active small{
        color:var(--rfbd8-primary);
      }

      .rfbd8-mode-tabs button:disabled{
        opacity:.52;
        cursor:not-allowed;
      }

      .rfbd8-queue-progress{
        color:var(--rfbd8-soft);
        font-size:11px;
        font-weight:700;
      }

      .rfbd8-workspace{
        min-height:620px;
        display:grid;
        grid-template-columns:minmax(220px,260px) minmax(360px,1fr) minmax(260px,320px);
        overflow:hidden;
        background:var(--rfbd8-surface);
        border:1px solid var(--rfbd8-line);
        border-radius:18px;
        box-shadow:var(--rfbd8-shadow);
      }

      .rfbd8-workspace.embedded{
        grid-template-columns:minmax(380px,1fr) minmax(260px,330px);
      }

      .rfbd8-queue,
      .rfbd8-context{
        min-width:0;
        display:flex;
        flex-direction:column;
        background:#fafbfc;
      }

      .rfbd8-queue{
        border-right:1px solid var(--rfbd8-line);
      }

      .rfbd8-context{
        border-left:1px solid var(--rfbd8-line);
      }

      .rfbd8-panel-head{
        min-height:67px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding:14px 14px 10px;
      }

      .rfbd8-panel-head > div{
        display:grid;
        gap:2px;
      }

      .rfbd8-panel-head span{
        color:var(--rfbd8-primary);
        font-size:9px;
        font-weight:800;
        letter-spacing:.07em;
        text-transform:uppercase;
      }

      .rfbd8-panel-head strong{
        font-size:14px;
        line-height:18px;
      }

      .rfbd8-panel-head > b{
        min-width:24px;
        height:24px;
        display:grid;
        place-items:center;
        padding:0 7px;
        color:var(--rfbd8-primary);
        background:var(--rfbd8-primary-soft);
        border-radius:999px;
        font-size:10px;
      }

      .rfbd8-search{
        display:flex;
        align-items:center;
        gap:7px;
        margin:0 12px 10px;
        padding:0 10px;
        min-height:38px;
        background:#fff;
        border:1px solid var(--rfbd8-line);
        border-radius:10px;
        color:var(--rfbd8-muted);
      }

      .rfbd8-search input{
        min-width:0;
        width:100%;
        height:36px;
        padding:0;
        color:var(--rfbd8-text);
        background:transparent;
        border:0;
        outline:0;
        font:500 11px/1 Inter,sans-serif;
      }

      .rfbd8-queue-list{
        min-height:0;
        flex:1;
        overflow:auto;
        padding:0 8px 10px;
      }

      .rfbd8-queue-item{
        width:100%;
        display:grid;
        grid-template-columns:34px minmax(0,1fr) 14px;
        align-items:center;
        gap:8px;
        margin:2px 0;
        padding:9px;
        text-align:left;
        background:transparent;
        border:1px solid transparent;
        border-radius:11px;
        cursor:pointer;
        transition:.15s ease;
      }

      .rfbd8-queue-item:hover:not(:disabled){
        background:#fff;
        border-color:#e7e8f5;
      }

      .rfbd8-queue-item.active{
        background:#fff;
        border-color:#d5d6ff;
        box-shadow:0 5px 15px rgba(81,84,232,.08);
      }

      .rfbd8-queue-item:disabled{
        cursor:not-allowed;
      }

      .rfbd8-avatar{
        width:34px;
        height:34px;
        display:grid;
        place-items:center;
        flex:0 0 34px;
        color:#4547bd;
        background:linear-gradient(145deg,#ececff,#f7f4ff);
        border:1px solid #ddddff;
        border-radius:10px;
        font-size:12px;
        font-weight:800;
      }

      .rfbd8-avatar.large{
        width:52px;
        height:52px;
        flex-basis:52px;
        border-radius:15px;
        font-size:18px;
      }

      .rfbd8-queue-copy{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .rfbd8-queue-copy strong,
      .rfbd8-queue-copy small,
      .rfbd8-queue-copy em{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
      }

      .rfbd8-queue-copy strong{
        color:var(--rfbd8-text);
        font-size:11px;
        font-style:normal;
      }

      .rfbd8-queue-copy small{
        color:var(--rfbd8-soft);
        font-size:9px;
      }

      .rfbd8-queue-copy em{
        color:var(--rfbd8-primary);
        font-size:8px;
        font-style:normal;
        font-weight:700;
      }

      .rfbd8-chevron{
        color:#acb0b8;
        font-size:18px;
      }

      .rfbd8-empty{
        display:grid;
        gap:4px;
        margin:16px 8px;
        padding:18px 13px;
        text-align:center;
        background:#fff;
        border:1px dashed #dadde3;
        border-radius:12px;
      }

      .rfbd8-empty strong{
        font-size:12px;
      }

      .rfbd8-empty span{
        color:var(--rfbd8-muted);
        font-size:10px;
        line-height:15px;
      }

      .rfbd8-console{
        min-width:0;
        display:flex;
        flex-direction:column;
        align-items:center;
        gap:12px;
        padding:28px 24px 20px;
        background:
          radial-gradient(circle at 50% 0,rgba(81,84,232,.06),transparent 30%),
          #fff;
      }

      .rfbd8-call-card{
        width:min(100%,480px);
        display:grid;
        justify-items:center;
      }

      .rfbd8-lead-summary{
        width:100%;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:11px;
        margin-bottom:12px;
      }

      .rfbd8-lead-summary > div{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .rfbd8-lead-summary > div > span{
        color:var(--rfbd8-muted);
        font-size:9px;
        font-weight:700;
        text-transform:uppercase;
        letter-spacing:.06em;
      }

      .rfbd8-lead-summary strong{
        max-width:260px;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font:700 16px/21px Geist,Inter,sans-serif;
      }

      .rfbd8-lead-summary small{
        color:var(--rfbd8-soft);
        font-size:10px;
      }

      .rfbd8-number{
        min-height:36px;
        color:#20232a;
        font:600 25px/34px Geist,Inter,sans-serif;
        letter-spacing:.02em;
        text-align:center;
      }

      .rfbd8-call-state{
        display:flex;
        align-items:center;
        gap:8px;
        margin:3px 0 16px;
        color:var(--rfbd8-muted);
        font-size:10px;
      }

      .rfbd8-call-state strong{
        color:var(--rfbd8-text);
        font-variant-numeric:tabular-nums;
      }

      .rfbd8-keypad{
        width:min(100%,300px);
        display:grid;
        grid-template-columns:repeat(3,1fr);
        gap:8px;
      }

      .rfbd8-keypad.collapsed{
        display:none;
      }

      .rfbd8-keypad button{
        aspect-ratio:1.18/1;
        min-height:54px;
        display:grid;
        place-items:center;
        color:#24262b;
        background:#f8f9fb;
        border:1px solid #eaecf0;
        border-radius:14px;
        cursor:pointer;
        font:700 18px/1 Geist,Inter,sans-serif;
        transition:.12s ease;
      }

      .rfbd8-keypad button:hover:not(:disabled){
        transform:translateY(-1px);
        background:#fff;
        border-color:#d7d8f6;
        box-shadow:0 7px 16px rgba(20,24,40,.06);
      }

      .rfbd8-keypad button:disabled{
        color:#a9adb5;
        cursor:default;
      }

      .rfbd8-call-controls{
        width:100%;
        min-height:64px;
        display:flex;
        align-items:center;
        justify-content:center;
        gap:10px;
        margin-top:18px;
      }

      .rfbd8-call-button{
        min-width:190px;
        min-height:54px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:9px;
        padding:0 22px;
        color:#fff;
        background:linear-gradient(145deg,#16a875,#087b55);
        border:0;
        border-radius:16px;
        cursor:pointer;
        box-shadow:0 12px 26px rgba(15,159,110,.25);
        font-size:13px;
        font-weight:800;
      }

      .rfbd8-call-button span{
        font-size:18px;
      }

      .rfbd8-call-button:disabled{
        opacity:.42;
        cursor:not-allowed;
        box-shadow:none;
      }

      .rfbd8-round-control,
      .rfbd8-end-button{
        min-width:82px;
        min-height:54px;
        display:grid;
        place-items:center;
        gap:2px;
        padding:7px 12px;
        border-radius:14px;
        cursor:pointer;
        font-size:10px;
        font-weight:800;
      }

      .rfbd8-round-control{
        color:var(--rfbd8-text);
        background:#fff;
        border:1px solid var(--rfbd8-line);
      }

      .rfbd8-round-control.active{
        color:var(--rfbd8-primary);
        background:var(--rfbd8-primary-soft);
        border-color:#d5d6ff;
      }

      .rfbd8-round-control span,
      .rfbd8-end-button span{
        font-size:17px;
      }

      .rfbd8-end-button{
        color:#fff;
        background:var(--rfbd8-red);
        border:1px solid var(--rfbd8-red);
      }

      .rfbd8-round-control:disabled,
      .rfbd8-end-button:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rfbd8-outcome{
        width:100%;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-top:13px;
        padding:9px 11px;
        color:var(--rfbd8-soft);
        background:#f7f8fa;
        border:1px solid var(--rfbd8-line);
        border-radius:10px;
        font-size:10px;
      }

      .rfbd8-outcome strong{
        color:var(--rfbd8-primary);
      }

      .rfbd8-consent{
        width:min(100%,480px);
        display:flex;
        align-items:flex-start;
        gap:9px;
        padding:10px 12px;
        background:#fafbfc;
        border:1px solid var(--rfbd8-line);
        border-radius:12px;
      }

      .rfbd8-consent input{
        width:16px;
        height:16px;
        flex:0 0 16px;
        margin:1px 0 0;
        accent-color:var(--rfbd8-primary);
      }

      .rfbd8-consent span{
        display:grid;
        gap:2px;
      }

      .rfbd8-consent strong{
        font-size:10px;
      }

      .rfbd8-consent small{
        color:var(--rfbd8-muted);
        font-size:9px;
        line-height:14px;
      }

      .rfbd8-context{
        padding-bottom:12px;
      }

      .rfbd8-context-card{
        display:grid;
        gap:0;
        margin:0 12px 10px;
        overflow:hidden;
        background:#fff;
        border:1px solid var(--rfbd8-line);
        border-radius:13px;
      }

      .rfbd8-context-title{
        display:flex;
        align-items:center;
        gap:9px;
        padding:11px;
        border-bottom:1px solid var(--rfbd8-line);
      }

      .rfbd8-context-title > div{
        min-width:0;
        display:grid;
        gap:1px;
      }

      .rfbd8-context-title strong{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:11px;
      }

      .rfbd8-context-title small{
        color:var(--rfbd8-muted);
        font-size:9px;
      }

      .rfbd8-context-field{
        display:grid;
        gap:2px;
        padding:9px 11px;
        border-bottom:1px solid #eff0f2;
      }

      .rfbd8-context-field:last-child{
        border-bottom:0;
      }

      .rfbd8-context-field span{
        color:var(--rfbd8-muted);
        font-size:8px;
        font-weight:700;
        text-transform:uppercase;
        letter-spacing:.05em;
      }

      .rfbd8-context-field strong{
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        color:var(--rfbd8-text);
        font-size:10px;
      }

      .rfbd8-history{
        margin:0 12px;
        padding:10px 11px;
        background:#fff;
        border:1px solid var(--rfbd8-line);
        border-radius:13px;
      }

      .rfbd8-history-head{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        margin-bottom:4px;
      }

      .rfbd8-history-head strong{
        font-size:10px;
      }

      .rfbd8-history-head span{
        min-width:20px;
        height:20px;
        display:grid;
        place-items:center;
        color:var(--rfbd8-primary);
        background:var(--rfbd8-primary-soft);
        border-radius:999px;
        font-size:8px;
        font-weight:800;
      }

      .rfbd8-history-row{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:7px 0;
        border-bottom:1px solid #eff0f2;
      }

      .rfbd8-history-row:last-child{
        border-bottom:0;
      }

      .rfbd8-history-row span{
        color:var(--rfbd8-text);
        font-size:9px;
        font-weight:700;
      }

      .rfbd8-history-row small{
        color:var(--rfbd8-muted);
        font-size:9px;
        font-variant-numeric:tabular-nums;
      }

      .rfbd8-history p{
        margin:7px 0 1px;
        color:var(--rfbd8-muted);
        font-size:9px;
        line-height:14px;
      }

      .rfbd8-ai-handoff{
        min-height:280px;
        display:grid;
        grid-template-columns:64px minmax(0,1fr) auto;
        align-items:center;
        gap:18px;
        padding:28px;
        background:
          radial-gradient(circle at 10% 20%,rgba(81,84,232,.13),transparent 35%),
          linear-gradient(135deg,#fafaff,#f5f7ff);
        border:1px solid #dedfff;
        border-radius:18px;
        box-shadow:var(--rfbd8-shadow);
      }

      .rfbd8-ai-mark{
        width:64px;
        height:64px;
        display:grid;
        place-items:center;
        color:#fff;
        background:linear-gradient(145deg,#5154e8,#7f50d8);
        border-radius:19px;
        box-shadow:0 14px 28px rgba(81,84,232,.22);
        font-size:18px;
        font-weight:900;
      }

      .rfbd8-ai-handoff strong{
        display:block;
        margin-bottom:4px;
        font:700 18px/24px Geist,Inter,sans-serif;
      }

      .rfbd8-ai-handoff p{
        max-width:650px;
        margin:0;
        color:var(--rfbd8-soft);
        font-size:12px;
        line-height:18px;
      }

      .rfbd8-button{
        min-height:42px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        padding:0 16px;
        border-radius:11px;
        cursor:pointer;
        font-size:11px;
        font-weight:800;
      }

      .rfbd8-button.primary{
        color:#fff;
        background:var(--rfbd8-primary);
        border:1px solid var(--rfbd8-primary);
      }

      @media(max-width:1120px){
        .rfbd8-workspace{
          grid-template-columns:220px minmax(340px,1fr);
        }

        .rfbd8-context{
          grid-column:1/-1;
          display:grid;
          grid-template-columns:1fr 1fr;
          gap:10px;
          padding:12px;
          border-left:0;
          border-top:1px solid var(--rfbd8-line);
        }

        .rfbd8-context .rfbd8-panel-head{
          grid-column:1/-1;
          padding:0;
          min-height:34px;
        }

        .rfbd8-context-card,
        .rfbd8-history{
          margin:0;
        }

        .rfbd8-workspace.embedded{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:760px){
        .rfbd8-topbar{
          align-items:flex-start;
          flex-direction:column;
        }

        .rfbd8-topbar-meta{
          justify-content:flex-start;
        }

        .rfbd8-modebar{
          align-items:stretch;
          flex-direction:column;
        }

        .rfbd8-mode-tabs{
          width:100%;
        }

        .rfbd8-mode-tabs button{
          min-width:0;
          flex:1;
        }

        .rfbd8-workspace{
          min-height:0;
          grid-template-columns:1fr;
        }

        .rfbd8-queue{
          max-height:300px;
          border-right:0;
          border-bottom:1px solid var(--rfbd8-line);
        }

        .rfbd8-console{
          padding:22px 14px 16px;
        }

        .rfbd8-context{
          grid-template-columns:1fr;
        }

        .rfbd8-context .rfbd8-panel-head{
          grid-column:auto;
        }

        .rfbd8-ai-handoff{
          grid-template-columns:1fr;
          text-align:center;
          justify-items:center;
        }

        .rfbd8-ai-handoff p{
          text-align:center;
        }

        .rfbd8-button{
          width:100%;
        }
      }

      @media(max-width:460px){
        .rfbd8-mode-tabs button{
          padding-inline:7px;
          font-size:10px;
        }

        .rfbd8-mode-tabs button small{
          font-size:8px;
        }

        .rfbd8-number{
          font-size:21px;
        }

        .rfbd8-keypad{
          width:100%;
        }

        .rfbd8-keypad button{
          min-height:50px;
        }

        .rfbd8-call-controls{
          flex-wrap:wrap;
        }

        .rfbd8-call-button{
          width:100%;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-business-dialer-v8 *,
        .rf-business-dialer-v8 *::before,
        .rf-business-dialer-v8 *::after{
          scroll-behavior:auto!important;
          transition:none!important;
          animation:none!important;
        }
      }
    `}</style>
  );
}

