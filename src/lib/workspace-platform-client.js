// apps/web/src/lib/workspace-platform-client.js

import { io } from "socket.io-client";

const DEFAULT_API_TIMEOUT_MS = 130_000;
const DEFAULT_UPLOAD_TIMEOUT_MS = 180_000;
const DEFAULT_DOWNLOAD_TIMEOUT_MS = 180_000;

const PRODUCTION_API_BASE_URL =
  "https://api.reachflyai.com/api";

function cleanBaseUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\/+$/, "");
}

function isBrowserHttps() {
  return (
    typeof window !== "undefined" &&
    window.location.protocol === "https:"
  );
}

function isLocalHostname(hostname) {
  const value = String(
    hostname || ""
  ).toLowerCase();

  return (
    value === "localhost" ||
    value === "127.0.0.1" ||
    value === "::1" ||
    value.endsWith(".localhost")
  );
}

function resolveApiBaseUrl() {
  const configured =
    cleanBaseUrl(
      import.meta.env.VITE_API_URL
    );

  const fallback =
    typeof window !== "undefined" &&
    isLocalHostname(
      window.location.hostname
    )
      ? "http://localhost:8787/api"
      : PRODUCTION_API_BASE_URL;

  const candidate =
    configured || fallback;

  try {
    const url = new URL(
      candidate,
      typeof window !== "undefined"
        ? window.location.origin
        : PRODUCTION_API_BASE_URL
    );

    /*
     * Never let the production HTTPS application call an HTTP API.
     * A local HTTP URL remains valid while developing on localhost.
     */
    if (
      isBrowserHttps() &&
      url.protocol === "http:" &&
      !isLocalHostname(url.hostname)
    ) {
      return PRODUCTION_API_BASE_URL;
    }

    const normalized =
      cleanBaseUrl(url.toString());

    return /\/api$/i.test(normalized)
      ? normalized
      : `${normalized}/api`;
  } catch {
    return fallback;
  }
}

function resolveSocketBaseUrl() {
  const configured =
    cleanBaseUrl(
      import.meta.env.VITE_SOCKET_URL
    );

  const apiOrigin =
    API_BASE_URL.replace(
      /\/api$/i,
      ""
    );

  /*
   * Prefer the API origin whenever an explicitly configured socket URL is
   * insecure on an HTTPS page. This prevents a stale value such as
   * ws://52.44.71.169:8787 from causing a browser Mixed Content failure.
   */
  let candidate =
    configured || apiOrigin;

  try {
    let url = new URL(
      candidate,
      typeof window !== "undefined"
        ? window.location.origin
        : apiOrigin
    );

    if (
      isBrowserHttps() &&
      ["http:", "ws:"].includes(
        url.protocol
      )
    ) {
      const secureApiUrl =
        new URL(apiOrigin);

      if (
        ["https:", "wss:"].includes(
          secureApiUrl.protocol
        )
      ) {
        url = secureApiUrl;
      } else {
        url.protocol =
          url.protocol === "ws:"
            ? "wss:"
            : "https:";
      }
    }

    if (url.protocol === "ws:") {
      url.protocol = "http:";
    }

    if (url.protocol === "wss:") {
      url.protocol = "https:";
    }

    /*
     * socket.io-client expects an HTTP(S) origin. It upgrades that connection
     * to WS/WSS automatically.
     */
    return url.origin;
  } catch {
    return cleanBaseUrl(apiOrigin);
  }
}

export const API_BASE_URL =
  resolveApiBaseUrl();

export const SOCKET_BASE_URL =
  resolveSocketBaseUrl();

let workspaceSocket = null;
let socketConnectingPromise = null;
let unauthorizedHandler = null;

const socketListeners = new Map();

export class ApiRequestError extends Error {
  constructor(
    message,
    {
      status = 0,
      code = "",
      details = null,
      response = null,
      cause = null,
      retryAfterMs = 0,
    } = {}
  ) {
    super(message);

    this.name = "ApiRequestError";
    this.status = status;
    this.statusCode = status;
    this.code = code;
    this.details = details;
    this.response = response;
    this.cause = cause;
    this.retryAfterMs =
      Math.max(
        0,
        Number(retryAfterMs) || 0
      );
  }
}

/**
 * Register a callback that runs when an authenticated API request
 * or socket connection receives an unauthorized response.
 */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler =
    typeof handler === "function"
      ? handler
      : null;

  return () => {
    if (
      unauthorizedHandler === handler
    ) {
      unauthorizedHandler = null;
    }
  };
}

/**
 * Returns the token currently used by the application.
 */
export function getAccessToken() {
  return (
    localStorage.getItem("token") ||
    localStorage.getItem(
      "accessToken"
    ) ||
    sessionStorage.getItem("token") ||
    sessionStorage.getItem(
      "accessToken"
    ) ||
    ""
  );
}

/**
 * Saves an authentication token.
 */
export function setAccessToken(
  token,
  {
    persistent = true,
  } = {}
) {
  const value = String(
    token || ""
  ).trim();

  clearAccessToken();

  if (!value) {
    return;
  }

  const storage = persistent
    ? localStorage
    : sessionStorage;

  storage.setItem("token", value);

  if (workspaceSocket) {
    workspaceSocket.auth = {
      ...(workspaceSocket.auth || {}),
      token: value,
    };

    if (workspaceSocket.connected) {
      workspaceSocket.disconnect();
      workspaceSocket.connect();
    }
  }
}

/**
 * Removes authentication tokens from browser storage.
 */
export function clearAccessToken() {
  localStorage.removeItem("token");
  localStorage.removeItem(
    "accessToken"
  );

  sessionStorage.removeItem("token");
  sessionStorage.removeItem(
    "accessToken"
  );
}

/**
 * Main authenticated API request helper.
 *
 * Examples:
 *
 * apiRequest("/profile/me")
 *
 * apiRequest("/team-management/tasks", {
 *   method: "POST",
 *   body: {
 *     title: "Call assigned leads",
 *   },
 * })
 */
export async function apiRequest(
  path,
  {
    method = "GET",
    body,
    headers = {},
    timeoutMs = DEFAULT_API_TIMEOUT_MS,
    signal,
    responseType = "auto",
    authenticated = true,
    credentials = "include",
    cache = "no-store",
    query,
    idempotencyKey,
  } = {}
) {
  const url = buildApiUrl(
    path,
    query
  );

  const controller =
    new AbortController();

  const timeoutId =
    Number(timeoutMs) > 0
      ? window.setTimeout(() => {
          controller.abort(
            createTimeoutError(
              timeoutMs
            )
          );
        }, Number(timeoutMs))
      : null;

  const removeExternalAbort =
    connectAbortSignals(
      signal,
      controller
    );

  try {
    const token =
      authenticated
        ? getAccessToken()
        : "";

    const requestHeaders =
      new Headers(headers);

    if (
      !requestHeaders.has("Accept")
    ) {
      requestHeaders.set(
        "Accept",
        responseType === "blob"
          ? "*/*"
          : "application/json"
      );
    }

    if (token) {
      requestHeaders.set(
        "Authorization",
        `Bearer ${token}`
      );
    }

    if (idempotencyKey) {
      requestHeaders.set(
        "Idempotency-Key",
        String(idempotencyKey)
      );
    }

    const preparedBody =
      prepareRequestBody(
        body,
        requestHeaders
      );

    const response = await fetch(
      url,
      {
        method:
          String(method || "GET")
            .trim()
            .toUpperCase(),
        headers: requestHeaders,
        body: preparedBody,
        credentials,
        cache,
        signal: controller.signal,
      }
    );

    if (response.status === 401) {
      handleUnauthorized({
        source: "api",
        response,
      });
    }

    if (!response.ok) {
      throw await createApiError(
        response
      );
    }

    return await parseResponse(
      response,
      responseType
    );
  } catch (error) {
    if (
      error instanceof ApiRequestError
    ) {
      throw error;
    }

    if (
      error?.name === "AbortError" ||
      controller.signal.aborted
    ) {
      const reason =
        controller.signal.reason;

      throw new ApiRequestError(
        reason?.message ||
          `The request exceeded ${Math.ceil(
            Number(timeoutMs) /
              1000
          )} seconds.`,
        {
          code: "REQUEST_TIMEOUT",
          cause: error,
        }
      );
    }

    throw new ApiRequestError(
      error?.message ||
        "The server request failed.",
      {
        code: "NETWORK_ERROR",
        cause: error,
      }
    );
  } finally {
    if (timeoutId) {
      window.clearTimeout(
        timeoutId
      );
    }

    removeExternalAbort();
  }
}

/**
 * Uploads a FormData body using the standard authenticated API client.
 */
export async function uploadFile(
  path,
  {
    file,
    fieldName = "file",
    fields = {},
    filename,
    timeoutMs = DEFAULT_UPLOAD_TIMEOUT_MS,
    query,
    onProgress,
  } = {}
) {
  if (!(file instanceof Blob)) {
    throw new ApiRequestError(
      "A valid file is required.",
      {
        code: "INVALID_FILE",
      }
    );
  }

  const formData =
    new FormData();

  formData.append(
    fieldName,
    file,
    filename ||
      file.name ||
      "upload"
  );

  for (const [
    key,
    value,
  ] of Object.entries(fields)) {
    if (
      value === undefined ||
      value === null
    ) {
      continue;
    }

    if (
      value instanceof Blob
    ) {
      formData.append(key, value);
      continue;
    }

    if (
      typeof value === "object"
    ) {
      formData.append(
        key,
        JSON.stringify(value)
      );
      continue;
    }

    formData.append(
      key,
      String(value)
    );
  }

  if (
    typeof onProgress ===
    "function"
  ) {
    return uploadWithProgress(
      path,
      {
        formData,
        timeoutMs,
        query,
        onProgress,
      }
    );
  }

  return apiRequest(path, {
    method: "POST",
    body: formData,
    timeoutMs,
    query,
  });
}

/**
 * Downloads an authenticated API resource as a Blob.
 */
export async function downloadApiFile(
  path,
  {
    query,
    filename,
    timeoutMs = DEFAULT_DOWNLOAD_TIMEOUT_MS,
  } = {}
) {
  const response =
    await apiRequest(path, {
      query,
      responseType: "response",
      timeoutMs,
    });

  const blob =
    await response.blob();

  const resolvedFilename =
    filename ||
    getFilenameFromResponse(
      response
    ) ||
    "download";

  triggerBlobDownload(
    blob,
    resolvedFilename
  );

  return {
    blob,
    filename:
      resolvedFilename,
  };
}

/**
 * Downloads an audit PDF.
 */
export function downloadAuditPdf(
  auditId,
  {
    filename,
  } = {}
) {
  if (!auditId) {
    throw new ApiRequestError(
      "An audit ID is required.",
      {
        code:
          "AUDIT_ID_REQUIRED",
      }
    );
  }

  return downloadApiFile(
    `/lead-audits/${encodeURIComponent(
      auditId
    )}/pdf`,
    {
      filename,
    }
  );
}

/**
 * Downloads a lead-specific report PDF.
 */
export function downloadLeadReportPdf({
  leadId,
  reportType = "mini-audit",
  filename,
}) {
  if (!leadId) {
    throw new ApiRequestError(
      "A lead ID is required.",
      {
        code:
          "LEAD_ID_REQUIRED",
      }
    );
  }

  return downloadApiFile(
    `/leads/${encodeURIComponent(
      leadId
    )}/${encodeURIComponent(
      reportType
    )}/pdf`,
    {
      filename,
    }
  );
}

/**
 * Returns the shared authenticated Socket.IO instance.
 */
export function getWorkspaceSocket() {
  if (workspaceSocket) {
    refreshSocketAuthentication(
      workspaceSocket
    );

    return workspaceSocket;
  }

  workspaceSocket = io(
    SOCKET_BASE_URL,
    {
      path: "/socket.io",
      autoConnect: false,

      /*
       * socket.io-client receives an HTTPS origin above and automatically
       * opens WSS in production. Polling remains available as a fallback.
       */
      transports: [
        "websocket",
        "polling",
      ],
      upgrade: true,
      rememberUpgrade: true,
      withCredentials: true,
      reconnection: true,
      reconnectionAttempts:
        Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax:
        8_000,
      randomizationFactor: 0.4,
      timeout: 20_000,
      auth: {
        token:
          getAccessToken(),
      },
    }
  );

  workspaceSocket.on(
    "connect",
    () => {
      dispatchInternalSocketEvent(
        "socket:connected",
        {
          socketId:
            workspaceSocket.id,
        }
      );
    }
  );

  workspaceSocket.on(
    "disconnect",
    (reason) => {
      dispatchInternalSocketEvent(
        "socket:disconnected",
        {
          reason,
        }
      );
    }
  );

  if (import.meta.env.DEV) {
    console.info(
      "[workspace-platform-client] endpoints",
      {
        apiBaseUrl:
          API_BASE_URL,
        socketBaseUrl:
          SOCKET_BASE_URL,
      }
    );
  }

  workspaceSocket.on(
    "connect_error",
    (error) => {
      const status =
        Number(
          error?.data?.status ||
            error?.status ||
            error?.statusCode ||
            0
        );

      if (
        status === 401 ||
        status === 403 ||
        /unauthori|forbidden|token/i.test(
          error?.message || ""
        )
      ) {
        handleUnauthorized({
          source: "socket",
          error,
        });
      }

      dispatchInternalSocketEvent(
        "socket:error",
        {
          error,
          message:
            error?.message ||
            "Socket connection failed.",
        }
      );
    }
  );

  workspaceSocket.io.on(
    "reconnect_attempt",
    () => {
      refreshSocketAuthentication(
        workspaceSocket
      );
    }
  );

  bindRegisteredListeners(
    workspaceSocket
  );

  return workspaceSocket;
}

/**
 * Connects the shared workspace socket.
 */
export async function connectWorkspaceSocket() {
  const socket =
    getWorkspaceSocket();

  refreshSocketAuthentication(
    socket
  );

  if (socket.connected) {
    return socket;
  }

  if (
    socketConnectingPromise
  ) {
    return socketConnectingPromise;
  }

  socketConnectingPromise =
    new Promise(
      (resolve, reject) => {
        const cleanup = () => {
          socket.off(
            "connect",
            handleConnect
          );

          socket.off(
            "connect_error",
            handleError
          );
        };

        const handleConnect = () => {
          cleanup();
          resolve(socket);
        };

        const handleError = (
          error
        ) => {
          cleanup();

          reject(
            new ApiRequestError(
              error?.message ||
                "The workspace socket could not connect.",
              {
                code:
                  "SOCKET_CONNECTION_ERROR",
                cause: error,
              }
            )
          );
        };

        socket.once(
          "connect",
          handleConnect
        );

        socket.once(
          "connect_error",
          handleError
        );

        socket.connect();
      }
    ).finally(() => {
      socketConnectingPromise =
        null;
    });

  return socketConnectingPromise;
}

/**
 * Disconnects and removes the current workspace socket.
 */
export function disconnectWorkspaceSocket() {
  if (!workspaceSocket) {
    return;
  }

  workspaceSocket.removeAllListeners();
  workspaceSocket.disconnect();
  workspaceSocket = null;
  socketConnectingPromise = null;
}

/**
 * Subscribes to a workspace Socket.IO event.
 *
 * It returns a cleanup function suitable for useEffect.
 */
export function onWorkspaceSocket(
  eventName,
  listener,
  {
    connect = true,
  } = {}
) {
  const name = String(
    eventName || ""
  ).trim();

  if (!name) {
    throw new Error(
      "A socket event name is required."
    );
  }

  if (
    typeof listener !==
    "function"
  ) {
    throw new Error(
      "A socket listener function is required."
    );
  }

  const listeners =
    socketListeners.get(name) ||
    new Set();

  listeners.add(listener);
  socketListeners.set(
    name,
    listeners
  );

  const socket =
    getWorkspaceSocket();

  socket.on(name, listener);

  if (connect) {
    connectWorkspaceSocket().catch(
      () => {
        // The registered listener remains active.
        // Socket.IO will retry automatically.
      }
    );
  }

  let unsubscribed = false;

  return () => {
    if (unsubscribed) {
      return;
    }

    unsubscribed = true;

    socket.off(name, listener);

    const currentListeners =
      socketListeners.get(name);

    currentListeners?.delete(
      listener
    );

    if (
      currentListeners &&
      currentListeners.size === 0
    ) {
      socketListeners.delete(name);
    }
  };
}

/**
 * Subscribes to a workspace event only once.
 */
export function onceWorkspaceSocket(
  eventName,
  listener,
  options
) {
  let unsubscribe = null;

  const wrappedListener = (
    payload
  ) => {
    unsubscribe?.();
    listener(payload);
  };

  unsubscribe =
    onWorkspaceSocket(
      eventName,
      wrappedListener,
      options
    );

  return unsubscribe;
}

/**
 * Emits a workspace socket event and optionally waits for an acknowledgement.
 */
export async function emitWorkspaceSocket(
  eventName,
  payload = {},
  {
    timeoutMs = 15_000,
    waitForAcknowledgement = true,
  } = {}
) {
  const socket =
    await connectWorkspaceSocket();

  if (!waitForAcknowledgement) {
    socket.emit(
      eventName,
      payload
    );

    return null;
  }

  return new Promise(
    (resolve, reject) => {
      const timer =
        window.setTimeout(() => {
          reject(
            new ApiRequestError(
              `Socket event "${eventName}" timed out.`,
              {
                code:
                  "SOCKET_ACK_TIMEOUT",
              }
            )
          );
        }, timeoutMs);

      socket.emit(
        eventName,
        payload,
        (response) => {
          window.clearTimeout(
            timer
          );

          if (
            response?.ok === false ||
            response?.error
          ) {
            reject(
              new ApiRequestError(
                response.error ||
                  response.message ||
                  "The socket action failed.",
                {
                  code:
                    response.code ||
                    "SOCKET_ACTION_FAILED",
                  details:
                    response.details ||
                    null,
                }
              )
            );

            return;
          }

          resolve(
            response?.data ??
              response
          );
        }
      );
    }
  );
}

/**
 * Joins the currently authenticated user's workspace room.
 */
export function joinWorkspaceRoom(
  workspaceId
) {
  return emitWorkspaceSocket(
    "workspace:join",
    {
      workspaceId,
    }
  );
}

/**
 * Joins a chat conversation room.
 */
export function joinConversation(
  conversationId
) {
  return emitWorkspaceSocket(
    "chat:conversation:join",
    {
      conversationId,
    }
  );
}

/**
 * Leaves a chat conversation room.
 */
export function leaveConversation(
  conversationId
) {
  return emitWorkspaceSocket(
    "chat:conversation:leave",
    {
      conversationId,
    },
    {
      waitForAcknowledgement:
        false,
    }
  );
}

/**
 * Sends a typing indicator.
 */
export function sendTypingIndicator({
  conversationId,
  typing,
}) {
  return emitWorkspaceSocket(
    "chat:typing",
    {
      conversationId,
      typing:
        Boolean(typing),
    },
    {
      waitForAcknowledgement:
        false,
    }
  );
}

/**
 * Sends WebRTC signaling data for internal team calls.
 */
export function sendWebRtcSignal({
  targetUserId,
  callId,
  type,
  signal,
}) {
  return emitWorkspaceSocket(
    "internal-call:signal",
    {
      targetUserId,
      callId,
      type,
      signal,
    },
    {
      waitForAcknowledgement:
        false,
    }
  );
}

/**
 * Creates an idempotency key for call starts and other sensitive operations.
 */
export function createIdempotencyKey(
  prefix = "request"
) {
  const cryptoApi =
    globalThis.crypto;

  const random =
    typeof cryptoApi?.randomUUID ===
    "function"
      ? cryptoApi.randomUUID()
      : `${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}`;

  return `${String(
    prefix || "request"
  )
    .trim()
    .replace(/\s+/g, "-")}-${random}`;
}

/**
 * Converts a data URL into a Blob.
 */
export function dataUrlToBlob(
  dataUrl
) {
  const value = String(
    dataUrl || ""
  );

  const match = value.match(
    /^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,(.*)$/i
  );

  if (!match) {
    throw new ApiRequestError(
      "The supplied image data is invalid.",
      {
        code:
          "INVALID_DATA_URL",
      }
    );
  }

  const mimeType =
    match[1] ||
    "application/octet-stream";

  const isBase64 =
    Boolean(match[2]);

  const content = isBase64
    ? atob(match[3])
    : decodeURIComponent(
        match[3]
      );

  const bytes =
    new Uint8Array(
      content.length
    );

  for (
    let index = 0;
    index < content.length;
    index += 1
  ) {
    bytes[index] =
      content.charCodeAt(
        index
      );
  }

  return new Blob([bytes], {
    type: mimeType,
  });
}

/**
 * Returns true for timeout or network failures that may be safe to retry.
 */
export function isRetryableApiError(
  error
) {
  if (
    !(error instanceof ApiRequestError)
  ) {
    return false;
  }

  return (
    [
      "NETWORK_ERROR",
      "REQUEST_TIMEOUT",
    ].includes(error.code) ||
    [
      408,
      425,
      429,
      500,
      502,
      503,
      504,
    ].includes(error.status)
  );
}

/**
 * Retries an API operation using incremental delays.
 * When the server supplies Retry-After, that delay is honored (capped at
 * 30 seconds) so client retries do not immediately add more rate-limit load.
 */
export async function retryApiRequest(
  operation,
  {
    retries = 2,
    delayMs = 700,
    shouldRetry =
      isRetryableApiError,
  } = {}
) {
  let lastError = null;

  for (
    let attempt = 0;
    attempt <= retries;
    attempt += 1
  ) {
    try {
      return await operation(
        attempt
      );
    } catch (error) {
      lastError = error;

      if (
        attempt >= retries ||
        !shouldRetry(error)
      ) {
        throw error;
      }

      const retryDelay =
        Math.max(
          delayMs *
            (attempt + 1),
          Math.min(
            Number(
              error?.retryAfterMs ||
                0
            ) || 0,
            30_000
          )
        );

      await wait(
        retryDelay
      );
    }
  }

  throw lastError;
}

function buildApiUrl(
  path,
  query
) {
  const rawPath = String(
    path || ""
  ).trim();

  const baseUrl =
    /^https?:\/\//i.test(rawPath)
      ? rawPath
      : `${API_BASE_URL}/${rawPath.replace(
          /^\/+/,
          ""
        )}`;

  const url = new URL(
    baseUrl,
    window.location.origin
  );

  if (
    query &&
    typeof query === "object"
  ) {
    for (const [
      key,
      value,
    ] of Object.entries(query)) {
      if (
        value === undefined ||
        value === null ||
        value === ""
      ) {
        continue;
      }

      if (Array.isArray(value)) {
        for (const item of value) {
          url.searchParams.append(
            key,
            String(item)
          );
        }

        continue;
      }

      url.searchParams.set(
        key,
        String(value)
      );
    }
  }

  return url.toString();
}

function prepareRequestBody(
  body,
  headers
) {
  if (
    body === undefined ||
    body === null
  ) {
    return undefined;
  }

  if (
    body instanceof FormData ||
    body instanceof Blob ||
    body instanceof ArrayBuffer ||
    body instanceof URLSearchParams ||
    typeof body === "string"
  ) {
    return body;
  }

  if (
    !headers.has(
      "Content-Type"
    )
  ) {
    headers.set(
      "Content-Type",
      "application/json"
    );
  }

  return JSON.stringify(body);
}

async function parseResponse(
  response,
  responseType
) {
  if (
    responseType === "response"
  ) {
    return response;
  }

  if (
    response.status === 204 ||
    response.status === 205
  ) {
    return null;
  }

  if (
    responseType === "blob"
  ) {
    return response.blob();
  }

  if (
    responseType === "arrayBuffer"
  ) {
    return response.arrayBuffer();
  }

  if (
    responseType === "text"
  ) {
    return response.text();
  }

  const contentType =
    String(
      response.headers.get(
        "content-type"
      ) || ""
    ).toLowerCase();

  if (
    responseType === "json" ||
    contentType.includes(
      "application/json"
    ) ||
    contentType.includes(
      "+json"
    )
  ) {
    return response
      .json()
      .catch(() => null);
  }

  if (
    contentType.includes(
      "application/pdf"
    ) ||
    contentType.includes(
      "application/octet-stream"
    ) ||
    contentType.startsWith(
      "image/"
    )
  ) {
    return response.blob();
  }

  const text =
    await response.text();

  if (
    responseType === "auto"
  ) {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }

  return text;
}

async function createApiError(
  response
) {
  let payload = null;

  const contentType =
    String(
      response.headers.get(
        "content-type"
      ) || ""
    ).toLowerCase();

  try {
    payload =
      contentType.includes(
        "application/json"
      ) ||
      contentType.includes(
        "+json"
      )
        ? await response.json()
        : await response.text();
  } catch {
    payload = null;
  }

  const message =
    extractErrorMessage(
      payload
    ) ||
    getStatusMessage(
      response.status
    );

  const retryAfterMs =
    getRetryAfterMs(
      response.headers.get(
        "retry-after"
      )
    );

  return new ApiRequestError(
    message,
    {
      status: response.status,
      code:
        payload?.code ||
        payload?.errorCode ||
        `HTTP_${response.status}`,
      details:
        payload?.details ||
        payload?.errors ||
        null,
      response: payload,
      retryAfterMs,
    }
  );
}

function getRetryAfterMs(value) {
  const raw =
    String(
      value || ""
    ).trim();

  if (!raw) {
    return 0;
  }

  const seconds =
    Number(raw);

  if (
    Number.isFinite(seconds) &&
    seconds >= 0
  ) {
    return Math.round(
      seconds * 1000
    );
  }

  const date =
    new Date(raw);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return 0;
  }

  return Math.max(
    0,
    date.getTime() -
      Date.now()
  );
}

function extractErrorMessage(
  payload
) {
  if (!payload) {
    return "";
  }

  if (
    typeof payload ===
    "string"
  ) {
    const text =
      payload.trim();

    if (!text) {
      return "";
    }

    /*
     * Express/Vercel can return an HTML error page for an API route mismatch.
     * Never print the entire HTML document into a caller-facing alert.
     */
    if (
      /<html[\s>]|<!doctype\s+html/i.test(
        text
      )
    ) {
      const preMatch =
        text.match(
          /<pre[^>]*>([\s\S]*?)<\/pre>/i
        );

      const source =
        preMatch?.[1] ||
        text;

      return source
        .replace(/<[^>]+>/g, " ")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
    }

    return text;
  }

  if (
    Array.isArray(
      payload.errors
    ) &&
    payload.errors.length
  ) {
    return payload.errors
      .map((item) =>
        typeof item === "string"
          ? item
          : item?.message ||
            item?.error ||
            ""
      )
      .filter(Boolean)
      .join(" ");
  }

  return String(
    payload.error ||
      payload.message ||
      payload.detail ||
      payload.title ||
      ""
  ).trim();
}

function getStatusMessage(
  status
) {
  const messages = {
    400:
      "The request was not valid.",
    401:
      "Your session has expired. Sign in again.",
    403:
      "You do not have permission to perform this action.",
    404:
      "The requested resource was not found.",
    409:
      "This action conflicts with an existing record.",
    413:
      "The uploaded content is too large.",
    422:
      "Some submitted information is invalid.",
    429:
      "ReachFly is receiving several requests at once. Wait a moment and try again.",
    500:
      "The server could not complete the request.",
    502:
      "The upstream service is unavailable.",
    503:
      "The service is temporarily unavailable.",
    504:
      "The upstream service did not respond in time.",
  };

  return (
    messages[status] ||
    `Request failed with status ${status}.`
  );
}

function connectAbortSignals(
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

  const abort = () => {
    controller.abort(
      externalSignal.reason
    );
  };

  externalSignal.addEventListener(
    "abort",
    abort,
    {
      once: true,
    }
  );

  return () => {
    externalSignal.removeEventListener(
      "abort",
      abort
    );
  };
}

function createTimeoutError(
  timeoutMs
) {
  const error = new Error(
    `The request exceeded ${Math.ceil(
      Number(timeoutMs) / 1000
    )} seconds.`
  );

  error.name = "AbortError";

  return error;
}

function handleUnauthorized(
  details
) {
  if (
    typeof unauthorizedHandler ===
    "function"
  ) {
    unauthorizedHandler(
      details
    );

    return;
  }

  window.dispatchEvent(
    new CustomEvent(
      "reachfly:unauthorized",
      {
        detail: details,
      }
    )
  );
}

function refreshSocketAuthentication(
  socket
) {
  socket.auth = {
    ...(socket.auth || {}),
    token: getAccessToken(),
  };
}

function bindRegisteredListeners(
  socket
) {
  for (const [
    eventName,
    listeners,
  ] of socketListeners.entries()) {
    for (const listener of listeners) {
      socket.off(
        eventName,
        listener
      );

      socket.on(
        eventName,
        listener
      );
    }
  }
}

function dispatchInternalSocketEvent(
  eventName,
  payload
) {
  window.dispatchEvent(
    new CustomEvent(
      `reachfly:${eventName}`,
      {
        detail: payload,
      }
    )
  );
}

function triggerBlobDownload(
  blob,
  filename
) {
  const url =
    URL.createObjectURL(blob);

  const anchor =
    document.createElement("a");

  anchor.href = url;
  anchor.download =
    filename ||
    "download";

  document.body.appendChild(
    anchor
  );

  anchor.click();
  anchor.remove();

  window.setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1_000);
}

function getFilenameFromResponse(
  response
) {
  const disposition =
    response.headers.get(
      "content-disposition"
    ) || "";

  const utfMatch =
    disposition.match(
      /filename\*=UTF-8''([^;]+)/i
    );

  if (utfMatch?.[1]) {
    try {
      return decodeURIComponent(
        utfMatch[1]
      );
    } catch {
      return utfMatch[1];
    }
  }

  const basicMatch =
    disposition.match(
      /filename="?([^";]+)"?/i
    );

  return (
    basicMatch?.[1]?.trim() ||
    ""
  );
}

function uploadWithProgress(
  path,
  {
    formData,
    timeoutMs,
    query,
    onProgress,
  }
) {
  return new Promise(
    (resolve, reject) => {
      const xhr =
        new XMLHttpRequest();

      const url = buildApiUrl(
        path,
        query
      );

      xhr.open(
        "POST",
        url,
        true
      );

      xhr.withCredentials = true;
      xhr.timeout =
        Number(timeoutMs) ||
        DEFAULT_UPLOAD_TIMEOUT_MS;

      xhr.setRequestHeader(
        "Accept",
        "application/json"
      );

      const token =
        getAccessToken();

      if (token) {
        xhr.setRequestHeader(
          "Authorization",
          `Bearer ${token}`
        );
      }

      xhr.upload.addEventListener(
        "progress",
        (event) => {
          if (
            !event.lengthComputable
          ) {
            return;
          }

          onProgress({
            loaded: event.loaded,
            total: event.total,
            percentage:
              Math.round(
                (event.loaded /
                  event.total) *
                  100
              ),
          });
        }
      );

      xhr.addEventListener(
        "load",
        () => {
          const payload =
            parseXhrPayload(xhr);

          if (
            xhr.status >= 200 &&
            xhr.status < 300
          ) {
            resolve(payload);
            return;
          }

          if (
            xhr.status === 401
          ) {
            handleUnauthorized({
              source: "upload",
              response: xhr,
            });
          }

          reject(
            new ApiRequestError(
              extractErrorMessage(
                payload
              ) ||
                getStatusMessage(
                  xhr.status
                ),
              {
                status:
                  xhr.status,
                code:
                  payload?.code ||
                  `HTTP_${xhr.status}`,
                response:
                  payload,
              }
            )
          );
        }
      );

      xhr.addEventListener(
        "error",
        () => {
          reject(
            new ApiRequestError(
              "The file upload failed.",
              {
                code:
                  "UPLOAD_NETWORK_ERROR",
              }
            )
          );
        }
      );

      xhr.addEventListener(
        "timeout",
        () => {
          reject(
            new ApiRequestError(
              "The file upload timed out.",
              {
                code:
                  "UPLOAD_TIMEOUT",
              }
            )
          );
        }
      );

      xhr.addEventListener(
        "abort",
        () => {
          reject(
            new ApiRequestError(
              "The file upload was cancelled.",
              {
                code:
                  "UPLOAD_CANCELLED",
              }
            )
          );
        }
      );

      xhr.send(formData);
    }
  );
}

function parseXhrPayload(xhr) {
  const text =
    xhr.responseText || "";

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function wait(milliseconds) {
  return new Promise(
    (resolve) => {
      window.setTimeout(
        resolve,
        milliseconds
      );
    }
  );
}
/**
 * Loads the authenticated user's role-aware ReachFly dashboard.
 *
 * The current backend exposes the dashboard data through /sales/dashboard.
 * Older Dashboard.jsx builds imported getRoleDashboard directly from this
 * module, so keep this compatibility wrapper here instead of duplicating
 * request logic inside the page component.
 */
export async function getRoleDashboard() {
  const response =
    await apiRequest(
      "/sales/dashboard"
    );

  const source =
    response &&
    typeof response === "object"
      ? response
      : {};

  const user =
    source.currentUser ||
    source.user ||
    {};

  const role =
    String(
      source.role ||
        user.workspaceRole ||
        user.role ||
        "viewer"
    )
      .trim()
      .toLowerCase()
      .replace(/[\s-]+/g, "_");

  const calls =
    Array.isArray(source.calls)
      ? source.calls
      : [];

  const assignments =
    Array.isArray(
      source.assignments
    )
      ? source.assignments
      : Array.isArray(
            source.records
          )
        ? source.records
        : [];

  const members =
    Array.isArray(source.members)
      ? source.members
      : [];

  const tasks =
    Array.isArray(source.tasks)
      ? source.tasks
      : [];

  const metrics =
    source.metrics &&
    typeof source.metrics ===
      "object"
      ? source.metrics
      : {};

  const todayKey =
    new Date()
      .toISOString()
      .slice(0, 10);

  const todayCalls =
    calls.filter((call) => {
      const value =
        call?.createdAt ||
        call?.startedAt ||
        call?.updatedAt ||
        "";

      return String(value)
        .slice(0, 10) ===
        todayKey;
    });

  const normalizedStatus =
    (value) =>
      String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, "_");

  const answeredCalls =
    todayCalls.filter((call) =>
      [
        "answered",
        "active",
        "completed",
        "contacted",
        "qualified",
        "meeting_booked",
        "converted",
      ].includes(
        normalizedStatus(
          call?.status ||
            call?.state ||
            call?.outcome
        )
      )
    ).length;

  const qualifiedLeads =
    assignments.filter(
      (assignment) =>
        [
          "qualified",
          "meeting_booked",
          "converted",
        ].includes(
          normalizedStatus(
            assignment?.status ||
              assignment?.outcome
          )
        )
    ).length;

  const meetingsBooked =
    assignments.filter(
      (assignment) =>
        normalizedStatus(
          assignment?.status ||
            assignment?.outcome
        ) === "meeting_booked"
    ).length;

  const pendingTasks =
    tasks.filter(
      (task) =>
        ![
          "completed",
          "done",
          "cancelled",
          "canceled",
          "closed",
        ].includes(
          normalizedStatus(
            task?.status
          )
        )
    ).length;

  const totalCallSeconds =
    todayCalls.reduce(
      (total, call) =>
        total +
        Math.max(
          0,
          Number(
            call?.durationSeconds ||
              call?.duration ||
              0
          ) || 0
        ),
      0
    );

  const summary = {
    ...metrics,

    managedMembers:
      metrics.managedMembers ??
      members.length,

    teamMembers:
      metrics.teamMembers ??
      members.length,

    activeMembers:
      metrics.activeMembers ??
      members.filter(
        (member) =>
          member?.active !== false &&
          member?.isActive !== false &&
          normalizedStatus(
            member?.status
          ) !== "suspended"
      ).length,

    onlineNow:
      metrics.onlineNow ??
      members.filter(
        (member) =>
          [
            "online",
            "available",
            "active",
          ].includes(
            normalizedStatus(
              member?.presence ||
                member?.availability ||
                member?.status
            )
          )
      ).length,

    assignedLeads:
      metrics.assignedLeads ??
      assignments.length,

    callsToday:
      metrics.callsToday ??
      todayCalls.length,

    answeredToday:
      metrics.answeredToday ??
      metrics.answeredCallsToday ??
      metrics.answeredCalls ??
      answeredCalls,

    answeredCallsToday:
      metrics.answeredCallsToday ??
      metrics.answeredToday ??
      answeredCalls,

    answeredCalls:
      metrics.answeredCalls ??
      metrics.answeredToday ??
      answeredCalls,

    followUpsDue:
      metrics.followUpsDue ??
      0,

    callbacksDue:
      metrics.callbacksDue ??
      metrics.followUpsDue ??
      0,

    pendingTasks:
      metrics.pendingTasks ??
      pendingTasks,

    qualifiedLeads:
      metrics.qualifiedLeads ??
      qualifiedLeads,

    meetingsBooked:
      metrics.meetingsBooked ??
      meetingsBooked,

    totalCallSeconds:
      metrics.totalCallSeconds ??
      totalCallSeconds,

    checkedIn:
      metrics.checkedIn ??
      metrics.checkedInToday ??
      0,

    checkedInToday:
      metrics.checkedInToday ??
      metrics.checkedIn ??
      0,
  };

  return {
    ...source,

    role,

    currentUser:
      source.currentUser ||
      user,

    workspace:
      source.workspace ||
      {},

    summary,

    members,

    team:
      Array.isArray(source.team)
        ? source.team
        : members,

    teamPerformance:
      Array.isArray(
        source.teamPerformance
      )
        ? source.teamPerformance
        : members,

    assignments,

    assignedLeads:
      Array.isArray(
        source.assignedLeads
      )
        ? source.assignedLeads
        : assignments,

    calls,

    recentCalls:
      Array.isArray(
        source.recentCalls
      )
        ? source.recentCalls
        : calls.slice(0, 20),

    tasks,

    overdueActions:
      Array.isArray(
        source.overdueActions
      )
        ? source.overdueActions
        : [],

    recentActivity:
      Array.isArray(
        source.recentActivity
      )
        ? source.recentActivity
        : [],
  };
}


/**
 * Compatibility alias used by RoleOperations builds that call
 * workspacePlatform.salesDashboard().
 */
export async function salesDashboard() {
  return getRoleDashboard();
}
