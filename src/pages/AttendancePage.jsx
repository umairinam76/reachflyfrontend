import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
} from "react-router-dom";

import {
  useAuth,
} from "../auth/AuthContext";

import "../styles.css";
// import "./attendance.css";

const BROWSER_API_ORIGIN =
  typeof window !==
  "undefined"
    ? `${window.location.protocol}//${window.location.hostname}:8787`
    : "http://localhost:8787";

const CONFIGURED_API_URL =
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

const CONFIGURED_USES_LOCALHOST =
  /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?(?:\/|$)/i.test(
    CONFIGURED_API_URL
  );

const PAGE_IS_ON_LAN =
  typeof window !==
    "undefined" &&
  ![
    "localhost",
    "127.0.0.1",
    "::1",
  ].includes(
    window.location.hostname
  );

const RAW_API_URL =
  PAGE_IS_ON_LAN &&
  CONFIGURED_USES_LOCALHOST
    ? BROWSER_API_ORIGIN
    : CONFIGURED_API_URL ||
      BROWSER_API_ORIGIN;

const NORMALIZED_API_URL =
  RAW_API_URL
    .replace(
      /\/+$/,
      ""
    )
    .replace(
      /\/api\/api$/i,
      "/api"
    );

const API_BASE_URL =
  /\/api$/i.test(
    NORMALIZED_API_URL
  )
    ? NORMALIZED_API_URL
    : `${NORMALIZED_API_URL}/api`;


export default function AttendancePage() {
  const {
    user,
    isCaller,
  } = useAuth();

  const navigate =
    useNavigate();

  const videoRef =
    useRef(null);

  const canvasRef =
    useRef(null);

  const streamRef =
    useRef(null);

  const [
    attendance,
    setAttendance,
  ] = useState(null);

  const [
    history,
    setHistory,
  ] = useState([]);

  const [
    selfieDataUrl,
    setSelfieDataUrl,
  ] = useState("");

  const [
    cameraReady,
    setCameraReady,
  ] = useState(false);

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
    now,
    setNow,
  ] = useState(
    Date.now()
  );

  const checkedIn =
    Boolean(
      attendance?.checkInAt &&
      !attendance?.checkOutAt
    );

  const completed =
    Boolean(
      attendance?.checkOutAt
    );

  const durationSeconds =
    useMemo(
      () => {
        if (
          attendance
            ?.checkOutAt
        ) {
          return Number(
            attendance.durationSeconds ||
              0
          );
        }

        if (
          attendance
            ?.checkInAt
        ) {
          return Math.max(
            0,
            Math.round(
              (
                now -
                Date.parse(
                  attendance.checkInAt
                )
              ) /
                1000
            )
          );
        }

        return 0;
      },
      [
        attendance,
        now,
      ]
    );

  const request =
    useCallback(
      async (
        path,
        {
          method =
            "GET",
          body,
        } = {}
      ) => {
        const token =
          localStorage.getItem(
            "reachflyToken"
          ) ||
          localStorage.getItem(
            "token"
          ) ||
          sessionStorage.getItem(
            "reachflyToken"
          ) ||
          sessionStorage.getItem(
            "token"
          ) ||
          "";

        const response =
          await fetch(
            `${API_BASE_URL}${path}`,
            {
              method,
              headers: {
                Accept:
                  "application/json",
                ...(body
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
              ...(body
                ? {
                    body:
                      JSON.stringify(
                        body
                      ),
                  }
                : {}),
            }
          );

        const rawBody =
          await response.text();

        let data = null;

        try {
          data = rawBody
            ? JSON.parse(
                rawBody
              )
            : null;
        } catch {
          data = rawBody;
        }

        if (
          !response.ok
        ) {
          throw new Error(
            data?.error ||
              data?.message ||
              (
                typeof data ===
                  "string" &&
                data.trim()
                  ? data.trim()
                  : `Attendance request failed with status ${response.status}.`
              )
          );
        }

        if (
          typeof data ===
          "string"
        ) {
          throw new Error(
            `Attendance API returned a web page instead of JSON. Requested ${API_BASE_URL}${path}. Confirm VITE_API_URL ends with /api and restart Vite.`
          );
        }

        return data;
      },
      []
    );

  const load =
    useCallback(
      async () => {
        setLoading(true);
        setError("");

        try {
          const [
            todayResponse,
            historyResponse,
          ] =
            await Promise.all([
              request(
                "/attendance/today"
              ),
              request(
                "/attendance/history?limit=60"
              ),
            ]);

          setAttendance(
            todayResponse
              ?.attendance ||
              null
          );

          setHistory(
            Array.isArray(
              historyResponse
                ?.records
            )
              ? historyResponse
                  .records
              : []
          );
        } catch (
          requestError
        ) {
          setError(
            requestError
              ?.message ||
              "Attendance could not be loaded."
          );
        } finally {
          setLoading(false);
        }
      },
      [
        request,
      ]
    );

  useEffect(() => {
    if (
      user &&
      !isCaller
    ) {
      navigate(
        "/app/dashboard",
        {
          replace: true,
        }
      );
    }
  }, [
    isCaller,
    navigate,
    user,
  ]);

  useEffect(() => {
    void load();
  }, [
    load,
  ]);

  useEffect(() => {
    const timer =
      window.setInterval(
        () =>
          setNow(
            Date.now()
          ),
        1000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, []);

  useEffect(() => {
    return () => {
      streamRef.current
        ?.getTracks()
        .forEach(
          (track) =>
            track.stop()
        );
    };
  }, []);

  async function startCamera() {
    setError("");
    setSelfieDataUrl("");

    if (
      !navigator
        ?.mediaDevices
        ?.getUserMedia
    ) {
      setError(
        "Live camera access is unavailable. Use HTTPS or localhost and allow camera permission."
      );

      return;
    }

    try {
      streamRef.current
        ?.getTracks()
        .forEach(
          (track) =>
            track.stop()
        );

      const stream =
        await navigator
          .mediaDevices
          .getUserMedia({
            video: {
              facingMode:
                "user",
              width: {
                ideal:
                  960,
              },
              height: {
                ideal:
                  720,
              },
            },
            audio:
              false,
          });

      streamRef.current =
        stream;

      if (
        videoRef.current
      ) {
        videoRef.current.srcObject =
          stream;

        await videoRef.current.play();
      }

      setCameraReady(
        true
      );
    } catch (
      cameraError
    ) {
      setError(
        cameraError
          ?.message ||
          "Camera permission was denied."
      );
    }
  }

  function captureSelfie() {
    const video =
      videoRef.current;

    const canvas =
      canvasRef.current;

    if (
      !video ||
      !canvas ||
      !cameraReady
    ) {
      return;
    }

    const width =
      Math.min(
        960,
        video.videoWidth ||
          640
      );

    const height =
      Math.round(
        width *
          (
            (
              video.videoHeight ||
              480
            ) /
            (
              video.videoWidth ||
              640
            )
          )
      );

    canvas.width =
      width;

    canvas.height =
      height;

    const context =
      canvas.getContext(
        "2d"
      );

    context.drawImage(
      video,
      0,
      0,
      width,
      height
    );

    setSelfieDataUrl(
      canvas.toDataURL(
        "image/jpeg",
        0.82
      )
    );
  }

  async function getLocation() {
    if (
      !navigator
        ?.geolocation
    ) {
      return null;
    }

    return new Promise(
      (resolve) => {
        navigator
          .geolocation
          .getCurrentPosition(
            (position) =>
              resolve({
                latitude:
                  position
                    .coords
                    .latitude,
                longitude:
                  position
                    .coords
                    .longitude,
                accuracy:
                  position
                    .coords
                    .accuracy,
              }),
            () =>
              resolve(
                null
              ),
            {
              enableHighAccuracy:
                true,
              timeout:
                8000,
              maximumAge:
                30_000,
            }
          );
      }
    );
  }

  async function submit(
    action
  ) {
    if (
      !selfieDataUrl
    ) {
      setError(
        "Capture a live selfie before continuing."
      );

      return;
    }

    setSaving(true);
    setError("");

    try {
      const location =
        await getLocation();

      const response =
        await request(
          `/attendance/${action}`,
          {
            method:
              "POST",
            body: {
              selfieDataUrl,
              location,
            },
          }
        );

      setAttendance(
        response
          ?.attendance ||
          null
      );

      setSelfieDataUrl(
        ""
      );

      await load();
    } catch (
      requestError
    ) {
      setError(
        requestError
          ?.message ||
          "Attendance could not be updated."
      );
    } finally {
      setSaving(false);
    }
  }

  if (!isCaller) {
    return null;
  }

  return (
    <main className="attendance-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">
            Caller attendance
          </span>

          <h1>
            Check in and check out
          </h1>

          <p>
            Capture a live selfie for each shift action.
            Location is recorded when browser permission is available.
          </p>
        </div>

        <button
          type="button"
          className="btn light"
          onClick={() =>
            void load()
          }
        >
          Refresh
        </button>
      </header>

      {error ? (
        <div className="error-banner mb16">
          <strong>
            Attendance could not connect
          </strong>

          <span>
            {error}
          </span>

          <small>
            API endpoint: {API_BASE_URL}
          </small>
        </div>
      ) : null}

      <section className="attendance-metrics">
        <AttendanceMetric
          label="Current status"
          value={
            completed
              ? "Checked out"
              : checkedIn
                ? "Checked in"
                : "Not checked in"
          }
        />

        <AttendanceMetric
          label="Check-in time"
          value={
            formatTime(
              attendance
                ?.checkInAt
            )
          }
        />

        <AttendanceMetric
          label="Check-out time"
          value={
            formatTime(
              attendance
                ?.checkOutAt
            )
          }
        />

        <AttendanceMetric
          label="Shift duration"
          value={
            formatDuration(
              durationSeconds
            )
          }
        />
      </section>

      <section className="attendance-layout">
        <article className="card attendance-camera-card">
          <div className="flex flex-between mb16">
            <div>
              <span className="eyebrow">
                Live verification
              </span>

              <h2>
                Capture selfie
              </h2>
            </div>

            <span
              className={`attendance-status ${
                checkedIn
                  ? "active"
                  : completed
                    ? "complete"
                    : ""
              }`}
            >
              {checkedIn
                ? "On shift"
                : completed
                  ? "Shift complete"
                  : "Ready"}
            </span>
          </div>

          <div className="attendance-camera-frame">
            {selfieDataUrl ? (
              <img
                src={
                  selfieDataUrl
                }
                alt="Captured attendance selfie"
              />
            ) : (
              <video
                ref={videoRef}
                muted
                playsInline
              />
            )}
          </div>

          <canvas
            ref={canvasRef}
            hidden
          />

          <div className="attendance-camera-actions">
            <button
              type="button"
              className="btn light"
              onClick={
                startCamera
              }
              disabled={
                loading ||
                completed
              }
            >
              Start camera
            </button>

            <button
              type="button"
              className="btn ghost"
              onClick={
                captureSelfie
              }
              disabled={
                !cameraReady ||
                completed
              }
            >
              Capture selfie
            </button>

            {selfieDataUrl ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() =>
                  setSelfieDataUrl(
                    ""
                  )
                }
              >
                Retake
              </button>
            ) : null}
          </div>

          <button
            type="button"
            className="btn primary full mt16"
            disabled={
              saving ||
              completed ||
              !selfieDataUrl
            }
            onClick={() =>
              void submit(
                checkedIn
                  ? "check-out"
                  : "check-in"
              )
            }
          >
            {saving
              ? "Saving attendance…"
              : checkedIn
                ? "Check out with selfie"
                : "Check in with selfie"}
          </button>
        </article>

        <article className="card">
          <span className="eyebrow">
            Attendance history
          </span>

          <h2>
            Recent shifts
          </h2>

          {history.length ? (
            <div className="attendance-history">
              {history.map(
                (record) => (
                  <div
                    key={
                      record.id
                    }
                    className="attendance-history-row"
                  >
                    <div>
                      <b>
                        {formatDate(
                          record.dateKey ||
                            record.checkInAt
                        )}
                      </b>

                      <small>
                        {formatTime(
                          record.checkInAt
                        )}{" "}
                        –{" "}
                        {formatTime(
                          record.checkOutAt
                        )}
                      </small>
                    </div>

                    <strong>
                      {formatDuration(
                        record.durationSeconds
                      )}
                    </strong>
                  </div>
                )
              )}
            </div>
          ) : (
            <p className="text-muted">
              No attendance records yet.
            </p>
          )}
        </article>
      </section>
    </main>
  );
}

function AttendanceMetric({
  label,
  value,
}) {
  return (
    <article className="metric-card">
      <div className="metric-num sm">
        {value}
      </div>

      <div className="metric-label">
        {label}
      </div>
    </article>
  );
}

function formatTime(
  value
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? "—"
    : date.toLocaleTimeString(
        undefined,
        {
          hour:
            "numeric",
          minute:
            "2-digit",
        }
      );
}

function formatDate(
  value
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(
      value
    );

  return Number.isNaN(
    date.getTime()
  )
    ? "—"
    : date.toLocaleDateString(
        undefined,
        {
          weekday:
            "short",
          month:
            "short",
          day:
            "numeric",
        }
      );
}

function formatDuration(
  seconds
) {
  const total =
    Math.max(
      0,
      Number(
        seconds ||
          0
      )
    );

  const hours =
    Math.floor(
      total /
        3600
    );

  const minutes =
    Math.floor(
      (
        total %
        3600
      ) /
        60
    );

  const remainingSeconds =
    Math.floor(
      total %
        60
    );

  return `${String(
    hours
  ).padStart(
    2,
    "0"
  )}:${String(
    minutes
  ).padStart(
    2,
    "0"
  )}:${String(
    remainingSeconds
  ).padStart(
    2,
    "0"
  )}`;
}
