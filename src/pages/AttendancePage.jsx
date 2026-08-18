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

const PRODUCTION_API_BASE_URL =
  "https://api.reachflyai.com/api";

const CAMERA_STORAGE_KEY =
  "reachfly-attendance-camera-id";

const REQUEST_TIMEOUT_MS =
  20_000;

const CAMERA_READY_TIMEOUT_MS =
  7_000;

const LOCATION_TIMEOUT_MS =
  5_000;

const HISTORY_LIMIT =
  60;

const CAMERA_STATES = {
  IDLE: "idle",
  STARTING: "starting",
  READY: "ready",
  FAILED: "failed",
};

const PERMISSION_STATES = {
  GRANTED: "granted",
  DENIED: "denied",
  PROMPT: "prompt",
  UNKNOWN: "unknown",
};

const API_BASE_URL =
  resolveApiBaseUrl();

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

  const mountedRef =
    useRef(true);

  const cameraStartingRef =
    useRef(false);

  const autoStartAttemptedRef =
    useRef(false);

  const submitInProgressRef =
    useRef(false);

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
    cameraState,
    setCameraState,
  ] = useState(
    CAMERA_STATES.IDLE
  );

  const [
    cameraPermission,
    setCameraPermission,
  ] = useState(
    PERMISSION_STATES.UNKNOWN
  );

  const [
    cameraError,
    setCameraError,
  ] = useState("");

  const [
    cameraMessage,
    setCameraMessage,
  ] = useState(
    "Start the camera to capture a live selfie."
  );

  const [
    cameras,
    setCameras,
  ] = useState([]);

  const [
    selectedCameraId,
    setSelectedCameraId,
  ] = useState(
    () =>
      safelyReadStorage(
        CAMERA_STORAGE_KEY
      )
  );

  const [
    activeCameraLabel,
    setActiveCameraLabel,
  ] = useState("");

  const [
    mirrorPreview,
    setMirrorPreview,
  ] = useState(true);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    attendanceError,
    setAttendanceError,
  ] = useState("");

  const [
    attendanceWarning,
    setAttendanceWarning,
  ] = useState("");

  const [
    successMessage,
    setSuccessMessage,
  ] = useState("");

  const [
    locationStatus,
    setLocationStatus,
  ] = useState("idle");

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

  const cameraReady =
    cameraState ===
    CAMERA_STATES.READY;

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
          const checkInTime =
            Date.parse(
              attendance.checkInAt
            );

          if (
            Number.isNaN(
              checkInTime
            )
          ) {
            return 0;
          }

          return Math.max(
            0,
            Math.round(
              (
                now -
                checkInTime
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
          timeoutMs =
            REQUEST_TIMEOUT_MS,
          signal,
        } = {}
      ) => {
        const token =
          getAccessToken();

        const controller =
          new AbortController();

        const cleanupExternalSignal =
          connectAbortSignal(
            signal,
            controller
          );

        const timeout =
          window.setTimeout(
            () => {
              controller.abort(
                new DOMException(
                  "Request timed out.",
                  "TimeoutError"
                )
              );
            },
            Math.max(
              1_000,
              Number(
                timeoutMs ||
                  REQUEST_TIMEOUT_MS
              )
            )
          );

        try {
          const response =
            await fetch(
              buildApiUrl(
                path
              ),
              {
                method,
                credentials:
                  "include",
                cache:
                  "no-store",
                headers: {
                  Accept:
                    "application/json",
                  ...(body !==
                  undefined
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
                ...(body !==
                undefined
                  ? {
                      body:
                        JSON.stringify(
                          body
                        ),
                    }
                  : {}),
                signal:
                  controller.signal,
              }
            );

          const rawBody =
            await response.text();

          const data =
            parseResponseBody(
              rawBody
            );

          if (
            !response.ok
          ) {
            const requestId =
              response.headers.get(
                "x-request-id"
              ) ||
              data?.requestId ||
              "";

            const error =
              new Error(
                getApiErrorMessage(
                  data,
                  response.status
                )
              );

            error.status =
              response.status;

            error.requestId =
              requestId;

            error.payload =
              data;

            throw error;
          }

          if (
            typeof data ===
            "string"
          ) {
            throw new Error(
              `Attendance API returned text instead of JSON from ${buildApiUrl(
                path
              )}. Check VITE_API_URL and the API proxy configuration.`
            );
          }

          return data;
        } catch (
          requestError
        ) {
          if (
            requestError?.name ===
              "AbortError" ||
            requestError?.name ===
              "TimeoutError" ||
            controller.signal.aborted
          ) {
            throw new Error(
              "The attendance request took too long. Check the connection and try again."
            );
          }

          throw requestError;
        } finally {
          window.clearTimeout(
            timeout
          );

          cleanupExternalSignal();
        }
      },
      []
    );

  const load =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (silent) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        setAttendanceError("");
        setAttendanceWarning("");

        const [
          todayResult,
          historyResult,
        ] =
          await Promise.allSettled([
            request(
              "/attendance/today"
            ),
            request(
              `/attendance/history?limit=${HISTORY_LIMIT}`
            ),
          ]);

        if (
          !mountedRef.current
        ) {
          return;
        }

        let successCount = 0;
        const errors = [];

        if (
          todayResult.status ===
          "fulfilled"
        ) {
          successCount += 1;

          setAttendance(
            extractAttendance(
              todayResult.value
            )
          );
        } else {
          errors.push(
            `Current status: ${
              todayResult.reason
                ?.message ||
              "could not be loaded"
            }`
          );
        }

        if (
          historyResult.status ===
          "fulfilled"
        ) {
          successCount += 1;

          setHistory(
            extractAttendanceHistory(
              historyResult.value
            )
          );
        } else {
          errors.push(
            `History: ${
              historyResult.reason
                ?.message ||
              "could not be loaded"
            }`
          );
        }

        if (
          successCount === 0
        ) {
          setAttendanceError(
            errors.join(" ")
          );
        } else if (
          errors.length
        ) {
          setAttendanceWarning(
            errors.join(" ")
          );
        }

        setLoading(false);
        setRefreshing(false);
      },
      [
        request,
      ]
    );

  const stopCamera =
    useCallback(
      ({
        keepMessage = false,
      } = {}) => {
        const stream =
          streamRef.current;

        streamRef.current =
          null;

        stream
          ?.getTracks()
          .forEach(
            (track) => {
              try {
                track.stop();
              } catch {
                // The browser may already have ended the track.
              }
            }
          );

        if (
          videoRef.current
        ) {
          videoRef.current.srcObject =
            null;
        }

        cameraStartingRef.current =
          false;

        if (
          mountedRef.current
        ) {
          setCameraState(
            CAMERA_STATES.IDLE
          );

          setActiveCameraLabel("");

          if (!keepMessage) {
            setCameraMessage(
              "Camera stopped."
            );
          }
        }
      },
      []
    );

  const refreshCameraList =
    useCallback(
      async () => {
        if (
          !navigator
            ?.mediaDevices
            ?.enumerateDevices
        ) {
          setCameras([]);
          return [];
        }

        try {
          const devices =
            await navigator
              .mediaDevices
              .enumerateDevices();

          const availableCameras =
            devices
              .filter(
                (device) =>
                  device.kind ===
                  "videoinput"
              )
              .map(
                (
                  device,
                  index
                ) => ({
                  deviceId:
                    device.deviceId,
                  groupId:
                    device.groupId,
                  label:
                    device.label ||
                    `Camera ${
                      index + 1
                    }`,
                })
              );

          if (
            mountedRef.current
          ) {
            setCameras(
              availableCameras
            );

            if (
              selectedCameraId &&
              !availableCameras.some(
                (camera) =>
                  camera.deviceId ===
                  selectedCameraId
              )
            ) {
              setSelectedCameraId(
                ""
              );

              safelyRemoveStorage(
                CAMERA_STORAGE_KEY
              );
            }
          }

          return availableCameras;
        } catch (
          listError
        ) {
          console.warn(
            "[Attendance] Could not enumerate cameras:",
            listError
          );

          if (
            mountedRef.current
          ) {
            setCameras([]);
          }

          return [];
        }
      },
      [
        selectedCameraId,
      ]
    );

  const updateCameraPermission =
    useCallback(
      async () => {
        if (
          !navigator
            ?.permissions
            ?.query
        ) {
          setCameraPermission(
            PERMISSION_STATES.UNKNOWN
          );

          return PERMISSION_STATES.UNKNOWN;
        }

        try {
          const result =
            await navigator
              .permissions
              .query({
                name:
                  "camera",
              });

          const state =
            result?.state ||
            PERMISSION_STATES.UNKNOWN;

          if (
            mountedRef.current
          ) {
            setCameraPermission(
              state
            );
          }

          result.onchange =
            () => {
              if (
                mountedRef.current
              ) {
                setCameraPermission(
                  result.state ||
                    PERMISSION_STATES.UNKNOWN
                );
              }
            };

          return state;
        } catch {
          /*
           * Some browsers support camera access but do not expose the
           * camera permission through navigator.permissions.
           */
          if (
            mountedRef.current
          ) {
            setCameraPermission(
              PERMISSION_STATES.UNKNOWN
            );
          }

          return PERMISSION_STATES.UNKNOWN;
        }
      },
      []
    );

  const startCamera =
    useCallback(
      async ({
        deviceId =
          selectedCameraId,
        automatic = false,
      } = {}) => {
        if (
          cameraStartingRef.current
        ) {
          return;
        }

        setCameraError("");
        setSuccessMessage("");

        if (
          completed
        ) {
          setCameraError(
            "Today's shift is already complete."
          );

          return;
        }

        const supportError =
          getCameraSupportError();

        if (supportError) {
          setCameraState(
            CAMERA_STATES.FAILED
          );

          setCameraError(
            supportError
          );

          return;
        }

        cameraStartingRef.current =
          true;

        setCameraState(
          CAMERA_STATES.STARTING
        );

        setCameraMessage(
          automatic
            ? "Opening your saved camera…"
            : "Requesting camera access…"
        );

        setSelfieDataUrl("");

        const previousStream =
          streamRef.current;

        streamRef.current =
          null;

        previousStream
          ?.getTracks()
          .forEach(
            (track) => {
              try {
                track.stop();
              } catch {
                // Ignore tracks that already ended.
              }
            }
          );

        if (
          videoRef.current
        ) {
          videoRef.current.srcObject =
            null;
        }

        try {
          await refreshCameraList();

          const stream =
            await requestCameraStream({
              deviceId,
            });

          if (
            !mountedRef.current
          ) {
            stream
              .getTracks()
              .forEach(
                (track) =>
                  track.stop()
              );

            return;
          }

          const track =
            stream
              .getVideoTracks()[0];

          if (!track) {
            stream
              .getTracks()
              .forEach(
                (item) =>
                  item.stop()
              );

            throw new DOMException(
              "No usable video track was returned.",
              "NotFoundError"
            );
          }

          const settings =
            track.getSettings?.() ||
            {};

          const actualDeviceId =
            settings.deviceId ||
            deviceId ||
            "";

          const cameraList =
            await refreshCameraList();

          const matchingCamera =
            cameraList.find(
              (camera) =>
                camera.deviceId ===
                actualDeviceId
            );

          streamRef.current =
            stream;

          track.addEventListener(
            "ended",
            () => {
              if (
                streamRef.current !==
                stream
              ) {
                return;
              }

              streamRef.current =
                null;

              if (
                mountedRef.current
              ) {
                setCameraState(
                  CAMERA_STATES.FAILED
                );

                setCameraError(
                  "The camera was disconnected or stopped. Reconnect it and start the camera again."
                );

                setCameraMessage(
                  "Camera disconnected."
                );
              }
            },
            {
              once: true,
            }
          );

          const video =
            videoRef.current;

          if (!video) {
            throw new Error(
              "The camera preview is not available."
            );
          }

          video.srcObject =
            stream;

          video.muted =
            true;

          video.playsInline =
            true;

          video.autoplay =
            true;

          const playPromise =
            video.play();

          playPromise
            ?.catch?.(
              () => {
                /*
                 * loadedmetadata below is the readiness source of truth.
                 * The user can press Start camera again if playback is
                 * blocked by a browser-specific policy.
                 */
              }
            );

          await waitForVideoReady(
            video,
            CAMERA_READY_TIMEOUT_MS
          );

          if (
            streamRef.current !==
            stream
          ) {
            stream
              .getTracks()
              .forEach(
                (item) =>
                  item.stop()
              );

            return;
          }

          const facingMode =
            settings.facingMode ||
            "";

          const shouldMirror =
            facingMode !==
            "environment";

          setMirrorPreview(
            shouldMirror
          );

          setActiveCameraLabel(
            matchingCamera?.label ||
            track.label ||
            "Camera"
          );

          setSelectedCameraId(
            actualDeviceId
          );

          if (
            actualDeviceId
          ) {
            safelyWriteStorage(
              CAMERA_STORAGE_KEY,
              actualDeviceId
            );
          }

          setCameraPermission(
            PERMISSION_STATES.GRANTED
          );

          setCameraState(
            CAMERA_STATES.READY
          );

          setCameraMessage(
            "Camera is ready. Center your face and capture the selfie."
          );

          await refreshCameraList();
        } catch (
          cameraStartError
        ) {
          console.error(
            "[Attendance] Camera startup failed:",
            {
              name:
                cameraStartError
                  ?.name,
              message:
                cameraStartError
                  ?.message,
              constraint:
                cameraStartError
                  ?.constraint,
            }
          );

          stopCamera({
            keepMessage:
              true,
          });

          const errorMessage =
            getCameraErrorMessage(
              cameraStartError
            );

          if (
            mountedRef.current
          ) {
            setCameraState(
              CAMERA_STATES.FAILED
            );

            setCameraError(
              errorMessage
            );

            setCameraMessage(
              "Camera could not start."
            );

            if (
              cameraStartError
                ?.name ===
                "NotAllowedError" ||
              cameraStartError
                ?.name ===
                "SecurityError"
            ) {
              setCameraPermission(
                PERMISSION_STATES.DENIED
              );
            }

            if (
              [
                "NotFoundError",
                "OverconstrainedError",
              ].includes(
                cameraStartError
                  ?.name
              )
            ) {
              setSelectedCameraId(
                ""
              );

              safelyRemoveStorage(
                CAMERA_STORAGE_KEY
              );
            }
          }
        } finally {
          cameraStartingRef.current =
            false;
        }
      },
      [
        completed,
        refreshCameraList,
        selectedCameraId,
        stopCamera,
      ]
    );

  const captureSelfie =
    useCallback(
      () => {
        setCameraError("");
        setSuccessMessage("");

        const video =
          videoRef.current;

        const canvas =
          canvasRef.current;

        const stream =
          streamRef.current;

        const liveTrack =
          stream
            ?.getVideoTracks()
            ?.[0];

        if (
          !video ||
          !canvas ||
          !cameraReady ||
          !liveTrack ||
          liveTrack.readyState !==
            "live"
        ) {
          setCameraError(
            "The camera is not ready. Start the camera and wait for the live preview."
          );

          return;
        }

        if (
          video.readyState <
            HTMLMediaElement
              .HAVE_CURRENT_DATA ||
          !video.videoWidth ||
          !video.videoHeight
        ) {
          setCameraError(
            "The camera image is still loading. Wait a moment and try again."
          );

          return;
        }

        const sourceWidth =
          video.videoWidth;

        const sourceHeight =
          video.videoHeight;

        const targetWidth =
          Math.min(
            960,
            sourceWidth
          );

        const targetHeight =
          Math.max(
            1,
            Math.round(
              targetWidth *
                (
                  sourceHeight /
                  sourceWidth
                )
            )
          );

        canvas.width =
          targetWidth;

        canvas.height =
          targetHeight;

        const context =
          canvas.getContext(
            "2d",
            {
              alpha:
                false,
            }
          );

        if (!context) {
          setCameraError(
            "The browser could not create the selfie image."
          );

          return;
        }

        context.save();

        if (
          mirrorPreview
        ) {
          context.translate(
            targetWidth,
            0
          );

          context.scale(
            -1,
            1
          );
        }

        context.drawImage(
          video,
          0,
          0,
          targetWidth,
          targetHeight
        );

        context.restore();

        const image =
          canvas.toDataURL(
            "image/jpeg",
            0.84
          );

        if (
          !image ||
          image ===
            "data:,"
        ) {
          setCameraError(
            "The selfie could not be captured. Try again."
          );

          return;
        }

        setSelfieDataUrl(
          image
        );

        setCameraMessage(
          "Selfie captured. Review it, then submit attendance."
        );
      },
      [
        cameraReady,
        mirrorPreview,
      ]
    );

  const retakeSelfie =
    useCallback(
      async () => {
        setSelfieDataUrl("");
        setCameraError("");
        setSuccessMessage("");

        const liveTrack =
          streamRef.current
            ?.getVideoTracks()
            ?.[0];

        if (
          liveTrack?.readyState ===
          "live"
        ) {
          setCameraState(
            CAMERA_STATES.READY
          );

          setCameraMessage(
            "Camera is ready. Capture a new selfie."
          );

          const video =
            videoRef.current;

          if (
            video &&
            video.srcObject !==
              streamRef.current
          ) {
            video.srcObject =
              streamRef.current;
          }

          video
            ?.play()
            ?.catch?.(
              () => null
            );

          return;
        }

        await startCamera();
      },
      [
        startCamera,
      ]
    );

  const handleCameraSelection =
    useCallback(
      async (
        event
      ) => {
        const nextDeviceId =
          event.target.value;

        setSelectedCameraId(
          nextDeviceId
        );

        setSelfieDataUrl("");

        if (
          nextDeviceId
        ) {
          safelyWriteStorage(
            CAMERA_STORAGE_KEY,
            nextDeviceId
          );
        } else {
          safelyRemoveStorage(
            CAMERA_STORAGE_KEY
          );
        }

        if (
          cameraState ===
            CAMERA_STATES.READY ||
          cameraState ===
            CAMERA_STATES.FAILED
        ) {
          await startCamera({
            deviceId:
              nextDeviceId,
          });
        }
      },
      [
        cameraState,
        startCamera,
      ]
    );

  const getLocation =
    useCallback(
      async () => {
        if (
          !navigator
            ?.geolocation
        ) {
          setLocationStatus(
            "unsupported"
          );

          return null;
        }

        setLocationStatus(
          "requesting"
        );

        return new Promise(
          (resolve) => {
            navigator
              .geolocation
              .getCurrentPosition(
                (
                  position
                ) => {
                  if (
                    mountedRef.current
                  ) {
                    setLocationStatus(
                      "captured"
                    );
                  }

                  resolve({
                    latitude:
                      position.coords
                        .latitude,
                    longitude:
                      position.coords
                        .longitude,
                    accuracy:
                      position.coords
                        .accuracy,
                    capturedAt:
                      new Date()
                        .toISOString(),
                  });
                },
                (
                  locationError
                ) => {
                  console.info(
                    "[Attendance] Location unavailable:",
                    {
                      code:
                        locationError
                          ?.code,
                      message:
                        locationError
                          ?.message,
                    }
                  );

                  if (
                    mountedRef.current
                  ) {
                    setLocationStatus(
                      "unavailable"
                    );
                  }

                  /*
                   * Location is optional. Camera verification still allows
                   * attendance submission if location permission is denied
                   * or the device cannot obtain a position.
                   */
                  resolve(null);
                },
                {
                  enableHighAccuracy:
                    false,
                  timeout:
                    LOCATION_TIMEOUT_MS,
                  maximumAge:
                    60_000,
                }
              );
          }
        );
      },
      []
    );

  const submit =
    useCallback(
      async (
        action
      ) => {
        if (
          submitInProgressRef.current
        ) {
          return;
        }

        if (
          !selfieDataUrl
        ) {
          setCameraError(
            "Capture a live selfie before continuing."
          );

          return;
        }

        if (
          ![
            "check-in",
            "check-out",
          ].includes(
            action
          )
        ) {
          setAttendanceError(
            "Invalid attendance action."
          );

          return;
        }

        submitInProgressRef.current =
          true;

        setSaving(true);
        setAttendanceError("");
        setAttendanceWarning("");
        setCameraError("");
        setSuccessMessage("");

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
                  client: {
                    capturedAt:
                      new Date()
                        .toISOString(),
                    timeZone:
                      Intl
                        .DateTimeFormat()
                        .resolvedOptions()
                        .timeZone ||
                      "",
                    cameraLabel:
                      activeCameraLabel,
                    userAgent:
                      navigator
                        .userAgent,
                  },
                },
                timeoutMs:
                  30_000,
              }
            );

          if (
            !mountedRef.current
          ) {
            return;
          }

          const updatedAttendance =
            extractAttendance(
              response
            );

          if (
            updatedAttendance
          ) {
            setAttendance(
              updatedAttendance
            );
          }

          setSelfieDataUrl("");

          const successText =
            action ===
              "check-in"
              ? "Check-in completed successfully."
              : "Check-out completed successfully.";

          setSuccessMessage(
            successText
          );

          notifyAttendance(
            "success",
            action ===
              "check-in"
              ? "Checked in"
              : "Checked out",
            successText
          );

          stopCamera({
            keepMessage:
              true,
          });

          setCameraMessage(
            action ===
              "check-in"
              ? "Checked in. Start the camera again when you are ready to check out."
              : "Today's shift is complete."
          );

          void load({
            silent:
              true,
          });
        } catch (
          requestError
        ) {
          console.error(
            "[Attendance] Submit failed:",
            requestError
          );

          if (
            mountedRef.current
          ) {
            setAttendanceError(
              formatRequestError(
                requestError,
                "Attendance could not be updated."
              )
            );
          }
        } finally {
          submitInProgressRef.current =
            false;

          if (
            mountedRef.current
          ) {
            setSaving(false);
          }
        }
      },
      [
        activeCameraLabel,
        getLocation,
        load,
        request,
        selfieDataUrl,
        stopCamera,
      ]
    );

  useEffect(() => {
    mountedRef.current =
      true;

    return () => {
      mountedRef.current =
        false;
    };
  }, []);

  useEffect(() => {
    if (
      user &&
      !isCaller
    ) {
      navigate(
        "/app/dashboard",
        {
          replace:
            true,
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
        1_000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, []);

  useEffect(() => {
    void updateCameraPermission();
    void refreshCameraList();
  }, [
    refreshCameraList,
    updateCameraPermission,
  ]);

  useEffect(() => {
    const mediaDevices =
      navigator
        ?.mediaDevices;

    if (
      !mediaDevices
        ?.addEventListener
    ) {
      return undefined;
    }

    const handleDeviceChange =
      () => {
        void refreshCameraList();
      };

    mediaDevices
      .addEventListener(
        "devicechange",
        handleDeviceChange
      );

    return () => {
      mediaDevices
        .removeEventListener(
          "devicechange",
          handleDeviceChange
        );
    };
  }, [
    refreshCameraList,
  ]);

  useEffect(() => {
    if (
      loading ||
      completed ||
      autoStartAttemptedRef.current
    ) {
      return;
    }

    autoStartAttemptedRef.current =
      true;

    void (
      async () => {
        const permission =
          await updateCameraPermission();

        /*
         * Automatically reopen the camera only when permission is already
         * granted. When the browser still needs to prompt, the Start camera
         * button provides the required clear user action.
         */
        if (
          permission ===
          PERMISSION_STATES.GRANTED
        ) {
          await startCamera({
            automatic:
              true,
          });
        }
      }
    )();
  }, [
    completed,
    loading,
    startCamera,
    updateCameraPermission,
  ]);

  useEffect(() => {
    if (
      completed &&
      streamRef.current
    ) {
      stopCamera({
        keepMessage:
          true,
      });

      setCameraMessage(
        "Today's shift is complete."
      );
    }
  }, [
    completed,
    stopCamera,
  ]);

  useEffect(() => {
    return () => {
      stopCamera({
        keepMessage:
          true,
      });
    };
  }, [
    stopCamera,
  ]);

  if (!isCaller) {
    return null;
  }

  return (
    <main className="attendance-page rf-attendance-v7">
      <AttendanceV7Styles />
      <header className="page-heading">
        <div>
          <span className="eyebrow">
            Workday attendance
          </span>

          <h1>
            Start and finish your workday
          </h1>

          <p>
            Use a live camera capture for each attendance action. Location is attached when browser permission is available.
          </p>
        </div>

        <button
          type="button"
          className="btn light"
          onClick={() =>
            void load({
              silent:
                true,
            })
          }
          disabled={
            loading ||
            refreshing
          }
        >
          {refreshing
            ? "Refreshing…"
            : "Refresh"}
        </button>
      </header>

      {attendanceError ? (
        <div
          className="error-banner mb16"
          role="alert"
        >
          <strong>
            Attendance data unavailable
          </strong>

          <span>
            {attendanceError}
          </span>

          <small>
            Check your connection and try again. If the issue continues, contact your workspace administrator.
          </small>
        </div>
      ) : null}

      {attendanceWarning ? (
        <div
          className="error-banner mb16"
          role="status"
        >
          <strong>
            Attendance loaded partially
          </strong>

          <span>
            {attendanceWarning}
          </span>
        </div>
      ) : null}

      {successMessage ? (
        <div
          className="success-banner mb16"
          role="status"
        >
          <strong>
            Success
          </strong>

          <span>
            {successMessage}
          </span>
        </div>
      ) : null}

      <section className="attendance-metrics">
        <AttendanceMetric
          label="Current status"
          value={
            loading
              ? "Loading…"
              : completed
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

              <p
                className="text-muted"
                aria-live="polite"
              >
                {cameraMessage}
              </p>
            </div>

            <span
              className={`attendance-status ${
                checkedIn
                  ? "active"
                  : completed
                    ? "complete"
                    : cameraReady
                      ? "active"
                      : ""
              }`}
            >
              {completed
                ? "Shift complete"
                : cameraState ===
                    CAMERA_STATES.STARTING
                  ? "Starting camera"
                  : cameraReady
                    ? "Camera ready"
                    : checkedIn
                      ? "On shift"
                      : "Ready"}
            </span>
          </div>

          {cameraError ? (
            <div
              className="error-banner mb16"
              role="alert"
            >
              <strong>
                Camera unavailable
              </strong>

              <span>
                {cameraError}
              </span>

              <small>
                Permission:{" "}
                {formatPermissionState(
                  cameraPermission
                )}
              </small>
            </div>
          ) : null}

          {cameras.length >
          1 ? (
            <label
              className="attendance-camera-selector"
            >
              <span>
                Camera
              </span>

              <select
                value={
                  selectedCameraId
                }
                onChange={
                  handleCameraSelection
                }
                disabled={
                  cameraState ===
                    CAMERA_STATES.STARTING ||
                  saving ||
                  completed
                }
              >
                <option value="">
                  Automatic
                </option>

                {cameras.map(
                  (
                    camera,
                    index
                  ) => (
                    <option
                      key={
                        camera.deviceId ||
                        `${camera.groupId}-${index}`
                      }
                      value={
                        camera.deviceId
                      }
                    >
                      {camera.label}
                    </option>
                  )
                )}
              </select>
            </label>
          ) : null}

          <div
            className="attendance-camera-frame"
            style={{
              position:
                "relative",
              overflow:
                "hidden",
            }}
          >
            <video
              ref={videoRef}
              muted
              autoPlay
              playsInline
              aria-label="Live attendance camera preview"
              style={{
                display:
                  "block",
                width:
                  "100%",
                height:
                  "100%",
                objectFit:
                  "cover",
                background:
                  "#12131a",
                transform:
                  mirrorPreview
                    ? "scaleX(-1)"
                    : "none",
                visibility:
                  selfieDataUrl
                    ? "hidden"
                    : "visible",
              }}
            />

            {selfieDataUrl ? (
              <img
                src={
                  selfieDataUrl
                }
                alt="Captured attendance selfie"
                style={{
                  position:
                    "absolute",
                  inset:
                    0,
                  width:
                    "100%",
                  height:
                    "100%",
                  objectFit:
                    "cover",
                }}
              />
            ) : null}

            {!selfieDataUrl &&
            !cameraReady &&
            cameraState !==
              CAMERA_STATES.STARTING ? (
              <div
                className="attendance-camera-placeholder"
                style={{
                  position:
                    "absolute",
                  inset:
                    0,
                  display:
                    "grid",
                  placeItems:
                    "center",
                  padding:
                    "24px",
                  textAlign:
                    "center",
                  color:
                    "#858ba0",
                  background:
                    "linear-gradient(145deg, #f5f3ff, #f8f9fc)",
                }}
              >
                <span>
                  Camera preview will appear here.
                </span>
              </div>
            ) : null}

            {cameraState ===
            CAMERA_STATES.STARTING ? (
              <div
                className="attendance-camera-loading"
                style={{
                  position:
                    "absolute",
                  inset:
                    0,
                  display:
                    "grid",
                  placeItems:
                    "center",
                  padding:
                    "24px",
                  textAlign:
                    "center",
                  color:
                    "#5b3ee4",
                  background:
                    "rgba(248, 247, 255, 0.92)",
                }}
              >
                <span>
                  Opening camera…
                </span>
              </div>
            ) : null}
          </div>

          <canvas
            ref={canvasRef}
            hidden
          />

          <div
            className="attendance-camera-meta"
            aria-live="polite"
          >
            {activeCameraLabel ? (
              <small>
                Active camera:{" "}
                {activeCameraLabel}
              </small>
            ) : null}

            <small>
              Location:{" "}
              {formatLocationStatus(
                locationStatus
              )}
            </small>
          </div>

          <div className="attendance-camera-actions">
            <button
              type="button"
              className="btn light"
              onClick={() =>
                void startCamera()
              }
              disabled={
                loading ||
                saving ||
                completed ||
                cameraState ===
                  CAMERA_STATES.STARTING
              }
            >
              {cameraState ===
              CAMERA_STATES.STARTING
                ? "Starting camera…"
                : cameraReady
                  ? "Restart camera"
                  : "Start camera"}
            </button>

            <button
              type="button"
              className="btn ghost"
              onClick={
                captureSelfie
              }
              disabled={
                !cameraReady ||
                saving ||
                completed ||
                Boolean(
                  selfieDataUrl
                )
              }
            >
              Capture selfie
            </button>

            {selfieDataUrl ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() =>
                  void retakeSelfie()
                }
                disabled={
                  saving ||
                  completed
                }
              >
                Retake
              </button>
            ) : null}

            {streamRef.current ? (
              <button
                type="button"
                className="btn ghost"
                onClick={() =>
                  stopCamera()
                }
                disabled={
                  saving
                }
              >
                Stop camera
              </button>
            ) : null}
          </div>

          <button
            type="button"
            className="btn primary full mt16"
            disabled={
              saving ||
              loading ||
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
              ? locationStatus ===
                  "requesting"
                ? "Checking location…"
                : "Saving attendance…"
              : checkedIn
                ? "Check out with selfie"
                : "Check in with selfie"}
          </button>
        </article>

        <article className="card">
          <div className="flex flex-between mb16">
            <div>
              <span className="eyebrow">
                Attendance history
              </span>

              <h2>
                Recent shifts
              </h2>
            </div>

            {refreshing ? (
              <small className="text-muted">
                Updating…
              </small>
            ) : null}
          </div>

          {loading ? (
            <p className="text-muted">
              Loading attendance…
            </p>
          ) : history.length ? (
            <div className="attendance-history">
              {history.map(
                (
                  record,
                  index
                ) => (
                  <div
                    key={
                      record.id ||
                      `${record.checkInAt}-${index}`
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

function resolveApiBaseUrl() {
  const configured =
    cleanUrl(
      import.meta.env
        .VITE_API_URL
    );

  const browserIsLocal =
    typeof window !==
      "undefined" &&
    isLocalHostname(
      window.location.hostname
    );

  const fallback =
    browserIsLocal
      ? "http://localhost:8787/api"
      : PRODUCTION_API_BASE_URL;

  try {
    const candidate =
      new URL(
        configured ||
          fallback,
        typeof window !==
          "undefined"
          ? window.location.origin
          : PRODUCTION_API_BASE_URL
      );

    if (
      typeof window !==
        "undefined" &&
      window.location.protocol ===
        "https:" &&
      candidate.protocol ===
        "http:" &&
      !isLocalHostname(
        candidate.hostname
      )
    ) {
      return PRODUCTION_API_BASE_URL;
    }

    const normalizedPath =
      candidate.pathname
        .replace(
          /\/+/g,
          "/"
        )
        .replace(
          /\/api\/api\/?$/i,
          "/api"
        )
        .replace(
          /\/+$/,
          ""
        );

    candidate.pathname =
      /\/api$/i.test(
        normalizedPath
      )
        ? normalizedPath
        : `${normalizedPath}/api`
            .replace(
              /\/+/g,
              "/"
            );

    candidate.search =
      "";

    candidate.hash =
      "";

    return cleanUrl(
      candidate.toString()
    );
  } catch {
    return fallback;
  }
}

function buildApiUrl(
  path
) {
  const normalizedPath =
    String(
      path ||
      ""
    ).startsWith("/")
      ? String(
          path ||
          ""
        )
      : `/${String(
          path ||
          ""
        )}`;

  return `${API_BASE_URL}${normalizedPath}`;
}

function cleanUrl(
  value
) {
  return String(
    value ||
    ""
  )
    .trim()
    .replace(
      /\/+$/,
      ""
    );
}

function isLocalHostname(
  hostname
) {
  const value =
    String(
      hostname ||
      ""
    ).toLowerCase();

  return (
    value ===
      "localhost" ||
    value ===
      "127.0.0.1" ||
    value ===
      "::1" ||
    value.endsWith(
      ".localhost"
    )
  );
}

function getAccessToken() {
  return (
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
    ""
  );
}

function parseResponseBody(
  rawBody
) {
  if (!rawBody) {
    return null;
  }

  try {
    return JSON.parse(
      rawBody
    );
  } catch {
    return rawBody;
  }
}

function getApiErrorMessage(
  data,
  status
) {
  const upstreamError =
    data?.errors?.[0];

  return (
    upstreamError?.detail ||
    upstreamError?.title ||
    data?.error ||
    data?.message ||
    (
      typeof data ===
        "string" &&
      data.trim()
        ? data.trim()
        : `Attendance request failed with status ${status}.`
    )
  );
}

function formatRequestError(
  error,
  fallback
) {
  const message =
    error?.message ||
    fallback;

  const requestId =
    error?.requestId ||
    "";

  return requestId
    ? `${message} Request ID: ${requestId}`
    : message;
}

function connectAbortSignal(
  externalSignal,
  controller
) {
  if (!externalSignal) {
    return () => {};
  }

  if (
    externalSignal.aborted
  ) {
    controller.abort(
      externalSignal.reason
    );

    return () => {};
  }

  const abort =
    () => {
      controller.abort(
        externalSignal.reason
      );
    };

  externalSignal
    .addEventListener(
      "abort",
      abort,
      {
        once:
          true,
      }
    );

  return () => {
    externalSignal
      .removeEventListener(
        "abort",
        abort
      );
  };
}

function extractAttendance(
  payload
) {
  return (
    payload?.attendance ||
    payload?.data
      ?.attendance ||
    payload?.record ||
    null
  );
}

function extractAttendanceHistory(
  payload
) {
  const candidates = [
    payload?.records,
    payload?.history,
    payload?.attendance,
    payload?.data
      ?.records,
    payload?.data
      ?.history,
  ];

  return (
    candidates.find(
      Array.isArray
    ) ||
    []
  );
}

function getCameraSupportError() {
  if (
    typeof window ===
      "undefined" ||
    typeof navigator ===
      "undefined"
  ) {
    return "Camera access is unavailable outside the browser.";
  }

  if (
    !window.isSecureContext
  ) {
    return "Camera access requires HTTPS. Open the secure ReachFly website and try again.";
  }

  if (
    !navigator
      .mediaDevices
      ?.getUserMedia
  ) {
    return "This browser does not support live camera access.";
  }

  const permissionsPolicy =
    document
      .permissionsPolicy ||
    document
      .featurePolicy;

  if (
    permissionsPolicy
      ?.allowsFeature &&
    !permissionsPolicy
      .allowsFeature(
        "camera"
      )
  ) {
    return "Camera access is blocked by the page permissions policy.";
  }

  return "";
}

async function requestCameraStream({
  deviceId = "",
} = {}) {
  const mediaDevices =
    navigator
      .mediaDevices;

  const preferredConstraints = {
    audio:
      false,
    video: {
      ...(deviceId
        ? {
            deviceId: {
              ideal:
                deviceId,
            },
          }
        : {}),
      facingMode: {
        ideal:
          "user",
      },
      width: {
        ideal:
          1280,
      },
      height: {
        ideal:
          720,
      },
      frameRate: {
        ideal:
          24,
        max:
          30,
      },
    },
  };

  const fallbackConstraints = [
    preferredConstraints,
    {
      audio:
        false,
      video: {
        ...(deviceId
          ? {
              deviceId: {
                ideal:
                  deviceId,
              },
            }
          : {}),
        facingMode: {
          ideal:
            "user",
        },
      },
    },
    {
      audio:
        false,
      video:
        true,
    },
  ];

  let lastError = null;

  for (
    let index = 0;
    index <
    fallbackConstraints.length;
    index += 1
  ) {
    try {
      return await mediaDevices
        .getUserMedia(
          fallbackConstraints[
            index
          ]
        );
    } catch (
      cameraError
    ) {
      lastError =
        cameraError;

      const retryable =
        [
          "NotFoundError",
          "OverconstrainedError",
          "NotReadableError",
          "AbortError",
        ].includes(
          cameraError?.name
        );

      if (
        !retryable ||
        index ===
          fallbackConstraints.length -
            1
      ) {
        throw cameraError;
      }

      await delay(
        cameraError?.name ===
          "NotReadableError"
          ? 400
          : 100
      );
    }
  }

  throw (
    lastError ||
    new Error(
      "Camera could not be opened."
    )
  );
}

function waitForVideoReady(
  video,
  timeoutMs
) {
  if (
    video.readyState >=
      HTMLMediaElement
        .HAVE_METADATA &&
    video.videoWidth &&
    video.videoHeight
  ) {
    return Promise.resolve();
  }

  return new Promise(
    (
      resolve,
      reject
    ) => {
      let settled =
        false;

      const cleanup =
        () => {
          video.removeEventListener(
            "loadedmetadata",
            handleReady
          );

          video.removeEventListener(
            "canplay",
            handleReady
          );

          video.removeEventListener(
            "error",
            handleError
          );

          window.clearTimeout(
            timeout
          );
        };

      const finish =
        (
          callback,
          value
        ) => {
          if (settled) {
            return;
          }

          settled =
            true;

          cleanup();

          callback(
            value
          );
        };

      const handleReady =
        () => {
          if (
            video.videoWidth &&
            video.videoHeight
          ) {
            finish(
              resolve
            );
          }
        };

      const handleError =
        () => {
          finish(
            reject,
            new Error(
              "The browser could not display the camera preview."
            )
          );
        };

      const timeout =
        window.setTimeout(
          () => {
            finish(
              reject,
              new Error(
                "The camera opened, but the preview did not become ready."
              )
            );
          },
          timeoutMs
        );

      video.addEventListener(
        "loadedmetadata",
        handleReady
      );

      video.addEventListener(
        "canplay",
        handleReady
      );

      video.addEventListener(
        "error",
        handleError
      );
    }
  );
}

function getCameraErrorMessage(
  error
) {
  switch (
    error?.name
  ) {
    case "NotAllowedError":
    case "SecurityError":
      return "Camera permission is blocked. Allow camera access for www.reachflyai.com in the browser and enable camera access in operating-system privacy settings.";

    case "NotFoundError":
      return "No usable camera was found. Connect or enable a camera, then press Start camera again.";

    case "NotReadableError":
      return "The camera is busy or unavailable. Close Camera, Zoom, Teams, OBS, or other apps using it, then try again.";

    case "OverconstrainedError":
      return `The selected camera cannot satisfy the requested setting${
        error?.constraint
          ? ` (${error.constraint})`
          : ""
      }. Choose Automatic or another camera.`;

    case "AbortError":
      return "Camera startup was interrupted. Try again.";

    case "TypeError":
      return "Camera access is unavailable. Confirm the page uses HTTPS and the browser supports camera capture.";

    default:
      return (
        error?.message ||
        "The camera could not be started."
      );
  }
}

function safelyReadStorage(
  key
) {
  try {
    return (
      localStorage.getItem(
        key
      ) ||
      ""
    );
  } catch {
    return "";
  }
}

function safelyWriteStorage(
  key,
  value
) {
  try {
    localStorage.setItem(
      key,
      value
    );
  } catch {
    // Storage can be unavailable in private or restricted browser modes.
  }
}

function safelyRemoveStorage(
  key
) {
  try {
    localStorage.removeItem(
      key
    );
  } catch {
    // Ignore storage cleanup failures.
  }
}

function formatPermissionState(
  value
) {
  const labels = {
    granted:
      "Granted",
    denied:
      "Blocked",
    prompt:
      "Not requested",
    unknown:
      "Unknown",
  };

  return (
    labels[value] ||
    "Unknown"
  );
}

function formatLocationStatus(
  value
) {
  const labels = {
    idle:
      "Optional",
    requesting:
      "Checking…",
    captured:
      "Captured",
    unavailable:
      "Unavailable — submission still allowed",
    unsupported:
      "Not supported — submission still allowed",
  };

  return (
    labels[value] ||
    "Optional"
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

function delay(
  milliseconds
) {
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

function notifyAttendance(
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

function AttendanceV7Styles() {
  return (
    <style>{`
      .rf-attendance-v7{
        --rfa-card:#fff;
        --rfa-soft:#f6f7f8;
        --rfa-text:#191c1d;
        --rfa-text2:#4d4c59;
        --rfa-muted:#777784;
        --rfa-line:#e2e4e7;
        --rfa-primary:#4648d4;
        --rfa-primary-dark:#393bbb;
        --rfa-primary-soft:#e8e9ff;
        --rfa-green:#087a51;
        --rfa-green-soft:#e4f7ee;
        --rfa-red:#ba1a1a;
        --rfa-red-soft:#ffedeb;
        --rfa-dark:#2e3132;
        --rfa-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 52px;
        color:var(--rfa-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rfaAttendanceIn .24s var(--rfa-ease);
      }

      .rf-attendance-v7 *,
      .rf-attendance-v7 *::before,
      .rf-attendance-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rfaAttendanceIn{
        from{opacity:0;transform:translateY(5px)}
        to{opacity:1;transform:none}
      }

      @keyframes rfaAttendancePulse{
        0%,100%{opacity:.45}
        50%{opacity:1}
      }

      .rf-attendance-v7 .page-heading{
        display:flex;
        align-items:flex-end;
        justify-content:space-between;
        gap:22px;
        margin-bottom:17px;
      }

      .rf-attendance-v7 .page-heading > div{
        min-width:0;
      }

      .rf-attendance-v7 .eyebrow{
        display:block;
        margin:0 0 4px;
        color:var(--rfa-primary);
        font-size:9px;
        font-weight:800;
        letter-spacing:.09em;
        text-transform:uppercase;
      }

      .rf-attendance-v7 .page-heading h1{
        margin:0;
        font:600 32px/40px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rf-attendance-v7 .page-heading p{
        max-width:760px;
        margin:5px 0 0;
        color:var(--rfa-text2);
        font-size:12px;
        line-height:18px;
      }

      .rf-attendance-v7 .btn{
        min-height:39px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:6px;
        padding:7px 11px;
        border:1px solid transparent;
        border-radius:8px;
        cursor:pointer;
        font:700 7px/1 Inter,sans-serif;
        transition:.14s var(--rfa-ease);
      }

      .rf-attendance-v7 .btn:hover:not(:disabled){
        transform:translateY(-1px);
      }

      .rf-attendance-v7 .btn:disabled{
        opacity:.45;
        cursor:not-allowed;
      }

      .rf-attendance-v7 .btn.primary{
        color:#fff;
        background:var(--rfa-primary);
        border-color:var(--rfa-primary);
        box-shadow:0 7px 16px rgba(70,72,212,.14);
      }

      .rf-attendance-v7 .btn.primary:hover:not(:disabled){
        background:var(--rfa-primary-dark);
      }

      .rf-attendance-v7 .btn.light,
      .rf-attendance-v7 .btn.ghost{
        color:var(--rfa-text);
        background:#fff;
        border-color:var(--rfa-line);
      }

      .rf-attendance-v7 .btn.full{
        width:100%;
      }

      .rf-attendance-v7 .error-banner,
      .rf-attendance-v7 .success-banner{
        display:grid;
        gap:2px;
        padding:10px 12px;
        margin-bottom:11px!important;
        border:1px solid;
        border-radius:9px;
        animation:rfaAttendanceIn .16s var(--rfa-ease);
      }

      .rf-attendance-v7 .error-banner{
        color:#7c1d1d;
        background:var(--rfa-red-soft);
        border-color:#ffd0cc;
      }

      .rf-attendance-v7 .success-banner{
        color:#086846;
        background:var(--rfa-green-soft);
        border-color:#caeadb;
      }

      .rf-attendance-v7 .error-banner strong,
      .rf-attendance-v7 .success-banner strong{
        font-size:7px;
      }

      .rf-attendance-v7 .error-banner span,
      .rf-attendance-v7 .success-banner span,
      .rf-attendance-v7 .error-banner small{
        font-size:6.5px;
        line-height:11px;
      }

      .rf-attendance-v7 .attendance-metrics{
        display:grid;
        grid-template-columns:repeat(4,minmax(0,1fr));
        gap:9px;
        margin-bottom:12px;
      }

      .rf-attendance-v7 .metric-card{
        min-height:125px;
        display:grid;
        align-content:end;
        padding:14px;
        background:#fff;
        border:1px solid var(--rfa-line);
        border-radius:11px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rf-attendance-v7 .metric-num{
        color:var(--rfa-text);
        font:600 23px/29px Geist,Inter,sans-serif;
        letter-spacing:-.025em;
      }

      .rf-attendance-v7 .metric-num.sm{
        font-size:20px;
      }

      .rf-attendance-v7 .metric-label{
        margin-top:3px;
        color:var(--rfa-muted);
        font-size:6px;
        font-weight:750;
        text-transform:uppercase;
      }

      .rf-attendance-v7 .attendance-layout{
        display:grid;
        grid-template-columns:minmax(0,1.15fr) minmax(320px,.85fr);
        align-items:start;
        gap:12px;
      }

      .rf-attendance-v7 .card,
      .rf-attendance-v7 .attendance-camera-card{
        background:#fff;
        border:1px solid var(--rfa-line);
        border-radius:12px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rf-attendance-v7 .card{
        padding:14px;
      }

      .rf-attendance-v7 .attendance-camera-card{
        overflow:hidden;
        padding:0;
      }

      .rf-attendance-v7 .attendance-camera-card > .flex,
      .rf-attendance-v7 .attendance-camera-card > div:first-child{
        padding:13px 14px 10px;
      }

      .rf-attendance-v7 .attendance-camera-frame{
        position:relative;
        overflow:hidden;
        min-height:420px;
        display:grid;
        place-items:center;
        margin:0 14px;
        color:#fff;
        background:
          radial-gradient(circle at 75% 15%,rgba(70,72,212,.2),transparent 30%),
          #2e3132;
        border-radius:11px;
      }

      .rf-attendance-v7 .attendance-camera-frame video,
      .rf-attendance-v7 .attendance-camera-frame img{
        width:100%;
        height:100%;
        min-height:420px;
        object-fit:cover;
      }

      .rf-attendance-v7 .attendance-camera-placeholder,
      .rf-attendance-v7 .attendance-camera-loading{
        display:grid;
        place-items:center;
        align-content:center;
        gap:7px;
        width:100%;
        min-height:420px;
        padding:28px;
        color:rgba(244,246,247,.72);
        text-align:center;
      }

      .rf-attendance-v7 .attendance-camera-loading{
        animation:rfaAttendancePulse 1s infinite ease-in-out;
      }

      .rf-attendance-v7 .attendance-camera-selector{
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        align-items:end;
        gap:8px;
        padding:11px 14px 0;
      }

      .rf-attendance-v7 .attendance-camera-selector label{
        display:grid;
        gap:4px;
      }

      .rf-attendance-v7 .attendance-camera-selector label span,
      .rf-attendance-v7 .attendance-camera-meta span{
        color:var(--rfa-muted);
        font-size:5.8px;
        font-weight:700;
        text-transform:uppercase;
      }

      .rf-attendance-v7 .attendance-camera-selector select{
        width:100%;
        min-height:38px;
        padding:8px 9px;
        color:var(--rfa-text);
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
        outline:0;
        font-size:7px;
      }

      .rf-attendance-v7 .attendance-camera-selector select:focus{
        background:#fff;
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rf-attendance-v7 .attendance-camera-actions{
        display:flex;
        flex-wrap:wrap;
        gap:7px;
        padding:11px 14px;
      }

      .rf-attendance-v7 .attendance-camera-actions .btn{
        flex:1;
        min-width:120px;
      }

      .rf-attendance-v7 .attendance-camera-meta{
        display:grid;
        gap:5px;
        padding:10px 14px 14px;
        color:var(--rfa-text2);
        border-top:1px solid #eff0f1;
      }

      .rf-attendance-v7 .attendance-history{
        display:grid;
        gap:5px;
        margin-top:10px;
      }

      .rf-attendance-v7 .attendance-history-row{
        min-height:58px;
        display:grid;
        grid-template-columns:110px 1fr 1fr auto;
        align-items:center;
        gap:8px;
        padding:8px 10px;
        background:#f7f8f9;
        border:1px solid transparent;
        border-radius:8px;
      }

      .rf-attendance-v7 .attendance-history-row strong{
        font-size:6.5px;
      }

      .rf-attendance-v7 .attendance-history-row span,
      .rf-attendance-v7 .attendance-history-row small{
        color:var(--rfa-muted);
        font-size:5.8px;
      }

      .rf-attendance-v7 .text-muted{
        color:var(--rfa-muted)!important;
      }

      @media(max-width:1040px){
        .rf-attendance-v7{
          padding:22px;
        }

        .rf-attendance-v7 .attendance-metrics{
          grid-template-columns:1fr 1fr;
        }

        .rf-attendance-v7 .attendance-layout{
          grid-template-columns:1fr;
        }
      }

      @media(max-width:680px){
        .rf-attendance-v7{
          padding:18px 12px 80px;
        }

        .rf-attendance-v7 .page-heading{
          align-items:flex-start;
          flex-direction:column;
        }

        .rf-attendance-v7 .page-heading h1{
          font-size:25px;
          line-height:32px;
        }

        .rf-attendance-v7 .page-heading p{
          font-size:10px;
          line-height:16px;
        }

        .rf-attendance-v7 .page-heading .btn{
          width:100%;
        }

        .rf-attendance-v7 .attendance-camera-frame,
        .rf-attendance-v7 .attendance-camera-frame video,
        .rf-attendance-v7 .attendance-camera-frame img,
        .rf-attendance-v7 .attendance-camera-placeholder,
        .rf-attendance-v7 .attendance-camera-loading{
          min-height:330px;
        }

        .rf-attendance-v7 .attendance-camera-selector{
          grid-template-columns:1fr;
        }

        .rf-attendance-v7 .attendance-history-row{
          grid-template-columns:1fr 1fr;
        }
      }

      @media(max-width:420px){
        .rf-attendance-v7 .attendance-metrics{
          grid-template-columns:1fr;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-attendance-v7,
        .rf-attendance-v7 *,
        .rf-attendance-v7 *::before,
        .rf-attendance-v7 *::after{
          animation:none!important;
          transition-duration:.01ms!important;
        }
      }
    `}</style>
  );
}
