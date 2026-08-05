import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../api";
import "./TelnyxDialer.css";

const FINAL_STATES = new Set(["hangup", "destroy", "destroyed", "purge"]);

export default function TelnyxDialer({
  lead,
  assignmentId = "",
  campaignId = "",
  onCallComplete,
}) {
  const clientRef = useRef(null);
  const callRef = useRef(null);
  const localCallIdRef = useRef("");
  const startedAtRef = useRef(0);

  const [status, setStatus] = useState("disconnected");
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [recordingConsent, setRecordingConsent] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const phone = lead?.phone || lead?.internationalPhoneNumber || lead?.nationalPhoneNumber || "";

  useEffect(() => {
    if (!startedAtRef.current || !["active", "answered", "held"].includes(status)) {
      return undefined;
    }
    const timer = setInterval(() => {
      setElapsed(Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000)));
    }, 1000);
    return () => clearInterval(timer);
  }, [status]);

  const disconnect = useCallback(() => {
    try { callRef.current?.hangup?.(); } catch {}
    try { clientRef.current?.disconnect?.(); } catch {}
    callRef.current = null;
    clientRef.current = null;
    setStatus("disconnected");
  }, []);

  useEffect(() => () => disconnect(), [disconnect]);

  const connect = useCallback(async () => {
    if (clientRef.current) return clientRef.current;
    setBusy(true);
    setError("");
    setStatus("connecting");

    try {
      const [{ TelnyxRTC }, session] = await Promise.all([
        import("@telnyx/webrtc"),
        api.telnyxSession(),
      ]);

      const client = new TelnyxRTC({
        login_token: session.loginToken,
        debug: false,
        enableCallReports: true,
      });

      client.remoteElement = "reachfly-telnyx-remote-audio";

      client.on("telnyx.ready", () => setStatus("ready"));
      client.on("telnyx.error", (event) => {
        setError(event?.message || event?.error?.message || "Telnyx dialer error.");
      });
      client.on("telnyx.notification", async (notification) => {
        if (notification?.type !== "callUpdate" || !notification.call) return;
        const call = notification.call;
        callRef.current = call;
        const nextState = String(call.state || "").toLowerCase();
        setStatus(nextState || "calling");

        const ids = call.telnyxIDs || {};
        if (localCallIdRef.current) {
          api.linkTelnyxCall(localCallIdRef.current, {
            providerCallId: ids.call_leg_id || call.id || "",
            callControlId: ids.call_control_id || "",
            callSessionId: ids.call_session_id || "",
            state: nextState,
          }).catch(() => {});

          api.updateTelnyxCallState(localCallIdRef.current, {
            state: nextState,
            cause: call.cause || "",
            sipCode: call.sipCode || 0,
          }).catch(() => {});
        }

        if (["active", "answered"].includes(nextState) && !startedAtRef.current) {
          startedAtRef.current = Date.now();
        }

        if (FINAL_STATES.has(nextState)) {
          const durationSeconds = startedAtRef.current
            ? Math.max(0, Math.floor((Date.now() - startedAtRef.current) / 1000))
            : 0;
          if (localCallIdRef.current) {
            const result = await api.completeTelnyxCall(localCallIdRef.current, {
              status: "completed",
              durationSeconds,
            }).catch(() => null);
            onCallComplete?.(result?.call || null);
          }
          callRef.current = null;
          startedAtRef.current = 0;
          setElapsed(0);
          setMuted(false);
          setStatus("ready");
        }
      });

      clientRef.current = client;
      client.connect();
      return client;
    } catch (requestError) {
      setStatus("failed");
      setError(requestError?.message || "Could not connect the Telnyx dialer.");
      throw requestError;
    } finally {
      setBusy(false);
    }
  }, [onCallComplete]);

  const startCall = useCallback(async () => {
    if (!phone) {
      setError("This lead does not have a phone number.");
      return;
    }
    if (!recordingConsent) {
      setError("Confirm the approved recording disclosure/consent before calling.");
      return;
    }

    setBusy(true);
    setError("");
    try {
      const client = await connect();
      const created = await api.createTelnyxCall({
        toNumber: phone,
        leadId: lead?.id || "",
        campaignId: campaignId || lead?.campaignId || "",
        assignmentId: assignmentId || lead?.assignmentId || "",
        recordingConsent: true,
        recordingDisclosureVersion: "v1",
      });

      localCallIdRef.current = created.call.id;
      startedAtRef.current = 0;
      setElapsed(0);

      const call = client.newCall({
        destinationNumber: phone,
        callerNumber: created.call.fromNumber || undefined,
        callerName: created.call.callerName || "ReachFly",
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        trickleIce: true,
        customHeaders: created.customHeaders || [],
      });
      callRef.current = call;
      setStatus("calling");
    } catch (requestError) {
      setError(requestError?.message || "The call could not be started.");
    } finally {
      setBusy(false);
    }
  }, [assignmentId, campaignId, connect, lead, phone, recordingConsent]);

  const hangup = async () => {
    try { await callRef.current?.hangup?.(); } catch {}
  };

  const toggleMute = () => {
    const call = callRef.current;
    if (!call) return;
    if (muted) call.unmuteAudio?.();
    else call.muteAudio?.();
    setMuted((value) => !value);
  };

  return (
    <section className="cardish rf-telnyx-dialer">
      <audio id="reachfly-telnyx-remote-audio" autoPlay playsInline />

      <div className="section-title-row">
        <div>
          <span className="eyebrow">Telnyx dialer</span>
          <h3>{phone || "No phone number"}</h3>
          <p>Status: {status}{elapsed ? ` · ${formatDuration(elapsed)}` : ""}</p>
        </div>
        <span className={`badge badge-${["active", "answered"].includes(status) ? "green" : "gray"}`}>
          {status}
        </span>
      </div>

      {error ? <p className="error-banner">{error}</p> : null}

      <label className="rf-assignment-option">
        <input
          type="checkbox"
          checked={recordingConsent}
          onChange={(event) => setRecordingConsent(event.target.checked)}
          disabled={Boolean(callRef.current)}
        />
        Approved recording disclosure has been given and consent obtained where required.
      </label>

      <div className="flex flex-gap flex-wrap mt16">
        {!callRef.current ? (
          <button className="btn primary" type="button" onClick={startCall} disabled={busy || !phone}>
            {busy ? "Connecting…" : "Call lead"}
          </button>
        ) : (
          <>
            <button className="btn light" type="button" onClick={toggleMute}>
              {muted ? "Unmute" : "Mute"}
            </button>
            <button className="btn danger" type="button" onClick={hangup}>
              End call
            </button>
          </>
        )}
      </div>
    </section>
  );
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}
