const rawBase =
  import.meta.env.VITE_API_URL || "http://localhost:8787";

export const API_BASE_URL = String(rawBase).replace(/\/+$/, "");

const TOKEN_KEYS = ["reachflyToken", "token"];

/* ========================================================================== */
/* Authentication token helpers                                               */
/* ========================================================================== */

export function getToken() {
  for (const key of TOKEN_KEYS) {
    const localToken = localStorage.getItem(key);

    if (localToken) {
      return localToken;
    }

    const sessionToken = sessionStorage.getItem(key);

    if (sessionToken) {
      return sessionToken;
    }
  }

  return "";
}

export function setToken(token, { persistent = true } = {}) {
  clearToken();

  if (!token) {
    return;
  }

  const storage = persistent ? localStorage : sessionStorage;

  storage.setItem("reachflyToken", token);

  // Compatibility with older ReachFly components.
  storage.setItem("token", token);
}

export function clearToken() {
  for (const key of TOKEN_KEYS) {
    localStorage.removeItem(key);
    sessionStorage.removeItem(key);
  }
}

/* ========================================================================== */
/* URL helpers                                                                */
/* ========================================================================== */

function buildUrl(path) {
  const normalizedPath = String(path || "").startsWith("/")
    ? String(path)
    : `/${path}`;

  /**
   * Supports both:
   *
   * VITE_API_URL=http://localhost:8787
   *
   * and:
   *
   * VITE_API_URL=http://localhost:8787/api
   */
  if (
    API_BASE_URL.endsWith("/api") &&
    normalizedPath.startsWith("/api/")
  ) {
    return `${API_BASE_URL}${normalizedPath.slice(4)}`;
  }

  if (
    API_BASE_URL.endsWith("/api") &&
    normalizedPath === "/api"
  ) {
    return API_BASE_URL;
  }

  return `${API_BASE_URL}${normalizedPath}`;
}

function withQuery(path, values = {}) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(values || {})) {
    if (
      value === undefined ||
      value === null ||
      value === ""
    ) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (
          item !== undefined &&
          item !== null &&
          item !== ""
        ) {
          params.append(key, String(item));
        }
      }

      continue;
    }

    params.set(key, String(value));
  }

  const query = params.toString();

  return query ? `${path}?${query}` : path;
}

function encode(value) {
  return encodeURIComponent(String(value ?? ""));
}

function jsonOptions(method, data, options = {}) {
  return {
    ...options,
    method,
    body:
      data === undefined
        ? undefined
        : JSON.stringify(data),
  };
}

/* ========================================================================== */
/* Response handling                                                          */
/* ========================================================================== */

async function parseResponse(response) {
  if (response.status === 204) {
    return null;
  }

  const contentType =
    response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }

  const text = await response.text();

  if (!text) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      message: text,
    };
  }
}

/* ========================================================================== */
/* Main request function                                                      */
/* ========================================================================== */

export async function request(path, options = {}) {
  const {
    timeoutMs = 45_000,
    auth = true,
    headers: customHeaders = {},
    signal: externalSignal,
    ...fetchOptions
  } = options;

  const token = getToken();
  const requestBody = fetchOptions.body;

  const isFormData =
    typeof FormData !== "undefined" &&
    requestBody instanceof FormData;

  const controller = new AbortController();

  const timeoutId = globalThis.setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let removeAbortListener = null;

  if (externalSignal) {
    const abortRequest = () => controller.abort();

    if (externalSignal.aborted) {
      controller.abort();
    } else {
      externalSignal.addEventListener(
        "abort",
        abortRequest,
        {
          once: true,
        }
      );

      removeAbortListener = () => {
        externalSignal.removeEventListener(
          "abort",
          abortRequest
        );
      };
    }
  }

  try {
    const response = await fetch(buildUrl(path), {
      ...fetchOptions,

      signal: controller.signal,

      headers: {
        Accept: "application/json",

        ...(!isFormData && requestBody !== undefined
          ? {
              "Content-Type": "application/json",
            }
          : {}),

        ...(auth && token
          ? {
              Authorization: `Bearer ${token}`,
            }
          : {}),

        ...customHeaders,
      },
    });

    const body = await parseResponse(response);

    if (!response.ok) {
      const error = new Error(
        body?.error ||
          body?.message ||
          `Request failed (${response.status})`
      );

      error.status = response.status;
      error.code = body?.code;
      error.fields = body?.fields;
      error.details = body?.details;
      error.payload = body;

      if (
        response.status === 401 &&
        typeof window !== "undefined"
      ) {
        window.dispatchEvent(
          new CustomEvent("reachfly:unauthorized")
        );
      }

      throw error;
    }

    return body;
  } catch (error) {
    if (error?.name === "AbortError") {
      const timeoutError = new Error(
        "The request took too long. Please try again."
      );

      timeoutError.code = "REQUEST_TIMEOUT";

      throw timeoutError;
    }

    throw error;
  } finally {
    globalThis.clearTimeout(timeoutId);
    removeAbortListener?.();
  }
}

/* ========================================================================== */
/* ReachFly API                                                               */
/* ========================================================================== */

export const api = {
  /* ------------------------------------------------------------------------ */
  /* Token helpers                                                            */
  /* ------------------------------------------------------------------------ */

  getToken,
  setToken,
  clearToken,

  /* ------------------------------------------------------------------------ */
  /* Health                                                                   */
  /* ------------------------------------------------------------------------ */

  health: () =>
    request("/api/health", {
      auth: false,
    }),

  /* ------------------------------------------------------------------------ */
  /* Authentication                                                           */
  /* ------------------------------------------------------------------------ */

  signup: (data) =>
    request("/api/auth/signup", {
      ...jsonOptions("POST", data),
      auth: false,
    }),

  login: (data) =>
    request("/api/auth/login", {
      ...jsonOptions("POST", data),
      auth: false,
    }),

  me: () => request("/api/auth/me"),

  forgotPassword: (data) =>
    request("/api/auth/forgot-password", {
      ...jsonOptions("POST", data),
      auth: false,
    }),

  resetPassword: (data) =>
    request("/api/auth/reset-password", {
      ...jsonOptions("POST", data),
      auth: false,
    }),

  acceptInvite: (data) =>
    request("/api/auth/accept-invite", {
      ...jsonOptions("POST", data),
      auth: false,
    }),

  /* ------------------------------------------------------------------------ */
  /* Dashboard and analytics                                                  */
  /* ------------------------------------------------------------------------ */

  dashboard: () => request("/api/dashboard"),

  analytics: () => request("/api/analytics"),

  /* ------------------------------------------------------------------------ */
  /* Campaigns                                                                */
  /* ------------------------------------------------------------------------ */

  campaigns: (statusOrFilters = "") => {
    const filters =
      typeof statusOrFilters === "string"
        ? {
            status: statusOrFilters,
          }
        : statusOrFilters || {};

    return request(
      withQuery("/api/campaigns", filters)
    );
  },

  campaign: (id) =>
    request(`/api/campaigns/${encode(id)}`),

  createCampaign: (data) =>
    request("/api/campaigns", {
      ...jsonOptions("POST", data),
      timeoutMs: 120_000,
    }),

  deleteCampaign: (id) =>
    request(`/api/campaigns/${encode(id)}`, {
      method: "DELETE",
    }),

  updateCampaign: (id, data) =>
    request(
      `/api/campaigns/${encode(id)}`,
      jsonOptions("PATCH", data)
    ),

  updatePipeline: (id, pipeline) =>
    request(
      `/api/campaigns/${encode(id)}/pipeline`,
      jsonOptions("PATCH", {
        pipeline,
      })
    ),

  runPipeline: (id) =>
    request(
      `/api/campaigns/${encode(id)}/run-pipeline`,
      {
        method: "POST",
        timeoutMs: 120_000,
      }
    ),

  stopPipeline: (id) =>
    request(
      `/api/campaigns/${encode(id)}/stop-pipeline`,
      {
        method: "POST",
      }
    ),

  eventsUrl: (id) =>
    `${buildUrl(
      `/api/campaigns/${encode(id)}/events`
    )}?token=${encode(getToken())}`,

  /* ------------------------------------------------------------------------ */
  /* Territories and contacts                                                 */
  /* ------------------------------------------------------------------------ */

  territories: () => request("/api/territories"),

  contacts: (filters = {}) =>
    request(
      withQuery("/api/contacts", filters)
    ),

  /* ------------------------------------------------------------------------ */
  /* Lead discovery                                                           */
  /* ------------------------------------------------------------------------ */

  findLeads: (data) =>
    request("/api/leads/find", {
      ...jsonOptions("POST", data),
      timeoutMs: 180_000,
    }),

  resumeLeadDiscovery: (jobId) =>
    request("/api/leads/find/resume", {
      ...jsonOptions("POST", {
        jobId,
      }),
      timeoutMs: 180_000,
    }),

  leadDiscoveryJob: (jobId) =>
    request(
      `/api/leads/find/jobs/${encode(jobId)}`
    ),

  cancelLeadDiscovery: (jobId) =>
    request(
      `/api/leads/find/jobs/${encode(jobId)}/cancel`,
      {
        method: "POST",
      }
    ),

  myIpPreview: ({
    url = "",
    limit = 50,
  } = {}) =>
    request(
      withQuery("/api/leads/myip-preview", {
        url,
        limit,
      }),
      {
        timeoutMs: 180_000,
      }
    ),

  fetchMyIpSitesHistory: (data) =>
    request("/api/myip/sites-history", {
      ...jsonOptions("POST", data),
      timeoutMs: 180_000,
    }),

  resumeMyIpSitesHistory: (data) =>
    request("/api/myip/sites-history/resume", {
      ...jsonOptions("POST", data),
      timeoutMs: 180_000,
    }),

  myIpCaptchaUrl: (token) =>
    buildUrl(
      `/api/myip/captcha/${encode(token)}`
    ),

  /* ------------------------------------------------------------------------ */
  /* Team management                                                          */
  /* ------------------------------------------------------------------------ */

  team: () => request("/api/team"),

  teamMembers: () => request("/api/team"),

  inviteTeamMember: (data) =>
    request(
      "/api/team/invites",
      jsonOptions("POST", data)
    ),

  resendTeamInvite: (inviteId) =>
    request(
      `/api/team/invites/${encode(
        inviteId
      )}/resend`,
      {
        method: "POST",
      }
    ),

  cancelTeamInvite: (inviteId) =>
    request(
      `/api/team/invites/${encode(inviteId)}`,
      {
        method: "DELETE",
      }
    ),

  updateTeamMember: (memberId, data) =>
    request(
      `/api/team/${encode(memberId)}`,
      jsonOptions("PATCH", data)
    ),

  removeTeamMember: (memberId) =>
    request(`/api/team/${encode(memberId)}`, {
      method: "DELETE",
    }),

  teamPerformance: ({
    from = "",
    to = "",
    campaignId = "",
  } = {}) =>
    request(
      withQuery("/api/team/performance", {
        from,
        to,
        campaignId,
      })
    ),

  memberPerformance: (
    memberId,
    {
      from = "",
      to = "",
      campaignId = "",
    } = {}
  ) =>
    request(
      withQuery(
        `/api/team/${encode(
          memberId
        )}/performance`,
        {
          from,
          to,
          campaignId,
        }
      )
    ),

  /* ------------------------------------------------------------------------ */
  /* Lead assignment                                                          */
  /* ------------------------------------------------------------------------ */

  myLeads: ({
    status = "",
    assignedTo = "",
    campaignId = "",
    tag = "",
    search = "",
    due = "",
  } = {}) =>
    request(
      withQuery("/api/my-leads", {
        status,
        assignedTo,
        campaignId,
        tag,
        search,
        due,
      })
    ),

  assignLead: (
    campaignId,
    leadId,
    assignedTo
  ) =>
    request(
      `/api/campaigns/${encode(
        campaignId
      )}/leads/${encode(leadId)}/assignment`,
      jsonOptions("PATCH", {
        assignedTo,
      })
    ),

  unassignLead: (
    campaignId,
    leadId
  ) =>
    request(
      `/api/campaigns/${encode(
        campaignId
      )}/leads/${encode(leadId)}/assignment`,
      jsonOptions("PATCH", {
        assignedTo: "",
      })
    ),

  bulkAssignLeads: (
    campaignId,
    data
  ) =>
    request(
      `/api/campaigns/${encode(
        campaignId
      )}/leads/bulk-assign`,
      jsonOptions("POST", data)
    ),

  bulkUnassignLeads: (
    campaignId,
    leadIds = []
  ) =>
    request(
      `/api/campaigns/${encode(
        campaignId
      )}/leads/bulk-assign`,
      jsonOptions("POST", {
        leadIds,
        assignedTo: "",
        strategy: "unassign",
      })
    ),

  /* ------------------------------------------------------------------------ */
  /* Lead management                                                          */
  /* ------------------------------------------------------------------------ */

  lead: (campaignId, leadId) =>
    request(
      `/api/campaigns/${encode(
        campaignId
      )}/leads/${encode(leadId)}`
    ),

  updateLead: (
    campaignId,
    leadId,
    data
  ) =>
    request(
      `/api/campaigns/${encode(
        campaignId
      )}/leads/${encode(leadId)}`,
      jsonOptions("PATCH", data)
    ),

  deleteLead: (
    campaignId,
    leadId
  ) =>
    request(
      `/api/campaigns/${encode(
        campaignId
      )}/leads/${encode(leadId)}`,
      {
        method: "DELETE",
      }
    ),

  addLeadTag: (
    campaignId,
    leadId,
    tag
  ) =>
    request(
      `/api/campaigns/${encode(
        campaignId
      )}/leads/${encode(leadId)}/tags`,
      jsonOptions("POST", {
        tag,
      })
    ),

  removeLeadTag: (
    campaignId,
    leadId,
    tag
  ) =>
    request(
      `/api/campaigns/${encode(
        campaignId
      )}/leads/${encode(
        leadId
      )}/tags/${encode(tag)}`,
      {
        method: "DELETE",
      }
    ),

  /* ------------------------------------------------------------------------ */
  /* Calling activity                                                         */
  /* ------------------------------------------------------------------------ */

  logCall: (
    campaignId,
    leadId,
    data
  ) =>
    request(
      `/api/campaigns/${encode(
        campaignId
      )}/leads/${encode(leadId)}/calls`,
      jsonOptions("POST", data)
    ),

  callHistory: (
    campaignId,
    leadId
  ) =>
    request(
      `/api/campaigns/${encode(
        campaignId
      )}/leads/${encode(leadId)}/calls`
    ),

  scheduleLeadFollowUp: (
    campaignId,
    leadId,
    data
  ) =>
    request(
      `/api/campaigns/${encode(
        campaignId
      )}/leads/${encode(leadId)}/follow-up`,
      jsonOptions("POST", data)
    ),

  markLeadDoNotCall: (
    campaignId,
    leadId,
    reason = ""
  ) =>
    request(
      `/api/campaigns/${encode(
        campaignId
      )}/leads/${encode(leadId)}`,
      jsonOptions("PATCH", {
        status: "do_not_call",
        doNotCall: true,
        doNotCallReason: reason,
      })
    ),

  /* ------------------------------------------------------------------------ */
  /* Per-lead email                                                           */
  /* ------------------------------------------------------------------------ */

  sendLeadEmail: (
    campaignId,
    leadId,
    data
  ) =>
    request(
      `/api/campaigns/${encode(
        campaignId
      )}/leads/${encode(leadId)}/email`,
      {
        ...jsonOptions("POST", data),
        timeoutMs: 90_000,
      }
    ),

  leadEmailHistory: (
    campaignId,
    leadId
  ) =>
    request(
      `/api/campaigns/${encode(
        campaignId
      )}/leads/${encode(leadId)}/emails`
    ),

  /* ------------------------------------------------------------------------ */
  /* Audit reports                                                            */
  /* ------------------------------------------------------------------------ */

  audits: ({
    campaignId = "",
    leadId = "",
    status = "",
  } = {}) =>
    request(
      withQuery("/api/audits", {
        campaignId,
        leadId,
        status,
      })
    ),

  audit: (auditId) =>
    request(`/api/audits/${encode(auditId)}`),

  createAudit: (data) =>
    request("/api/audits", {
      ...jsonOptions("POST", data),
      timeoutMs: 180_000,
    }),

  deleteAudit: (auditId) =>
    request(`/api/audits/${encode(auditId)}`, {
      method: "DELETE",
    }),

  createLeadAudit: (
    campaignId,
    leadId,
    data = {}
  ) =>
    request(
      `/api/campaigns/${encode(
        campaignId
      )}/leads/${encode(leadId)}/audit`,
      {
        ...jsonOptions("POST", data),
        timeoutMs: 180_000,
      }
    ),

  /* ------------------------------------------------------------------------ */
  /* Batch audit jobs                                                         */
  /* ------------------------------------------------------------------------ */

  auditJobs: (campaignId = "") =>
    request(
      withQuery("/api/audit-jobs", {
        campaignId,
      })
    ),

  auditJob: (jobId) =>
    request(
      `/api/audit-jobs/${encode(jobId)}`
    ),

  createAuditJob: (
    campaignId,
    data = {}
  ) =>
    request(
      `/api/campaigns/${encode(
        campaignId
      )}/audit-jobs`,
      jsonOptions("POST", data)
    ),

  cancelAuditJob: (jobId) =>
    request(
      `/api/audit-jobs/${encode(jobId)}/cancel`,
      {
        method: "POST",
      }
    ),

  /* ------------------------------------------------------------------------ */
  /* Inbox                                                                    */
  /* ------------------------------------------------------------------------ */

  inbox: ({
    campaignId = "",
    accountId = "",
    type = "",
    unread = "",
    search = "",
  } = {}) =>
    request(
      withQuery("/api/inbox", {
        campaignId,
        accountId,
        type,
        unread,
        search,
      })
    ),

  syncInbox: (
    limit = 25,
    accountId = ""
  ) =>
    request(
      "/api/inbox/sync",
      jsonOptions("POST", {
        limit,
        accountId,
      })
    ),

  inboxMessage: (messageId) =>
    request(
      `/api/inbox/${encode(messageId)}`
    ),

  markInboxMessageRead: (messageId) =>
    request(
      `/api/inbox/${encode(messageId)}/read`,
      {
        method: "PATCH",
      }
    ),

  /* ------------------------------------------------------------------------ */
  /* Email configuration                                                      */
  /* ------------------------------------------------------------------------ */

  emailSettings: () =>
    request("/api/settings/email"),

  saveEmailSettings: (data) =>
    request(
      "/api/settings/email",
      jsonOptions("PUT", data)
    ),

  testEmailSettings: (data) =>
    request(
      "/api/settings/email/test",
      jsonOptions("POST", data)
    ),

  testIncomingEmailSettings: (data) =>
    request(
      "/api/settings/email/test-inbox",
      jsonOptions("POST", data)
    ),

  deleteEmailAccount: (accountId) =>
    request(
      `/api/settings/email/accounts/${encode(
        accountId
      )}`,
      {
        method: "DELETE",
      }
    ),

  /* ------------------------------------------------------------------------ */
  /* Sender identities                                                        */
  /* ------------------------------------------------------------------------ */

  senderIdentities: (accountId) =>
    request(
      `/api/settings/email/accounts/${encode(
        accountId
      )}/sender-identities`
    ),

  createSenderIdentity: (
    accountId,
    data
  ) =>
    request(
      `/api/settings/email/accounts/${encode(
        accountId
      )}/sender-identities`,
      jsonOptions("POST", data)
    ),

  updateSenderIdentity: (
    accountId,
    identityId,
    data
  ) =>
    request(
      `/api/settings/email/accounts/${encode(
        accountId
      )}/sender-identities/${encode(
        identityId
      )}`,
      jsonOptions("PATCH", data)
    ),

  deleteSenderIdentity: (
    accountId,
    identityId
  ) =>
    request(
      `/api/settings/email/accounts/${encode(
        accountId
      )}/sender-identities/${encode(
        identityId
      )}`,
      {
        method: "DELETE",
      }
    ),

  sendSenderIdentityVerification: (
    accountId,
    identityId
  ) =>
    request(
      `/api/settings/email/accounts/${encode(
        accountId
      )}/sender-identities/${encode(
        identityId
      )}/send-verification`,
      {
        method: "POST",
      }
    ),

  verifySenderIdentity: (data) =>
    request(
      "/api/settings/email/sender-identities/verify",
      {
        ...jsonOptions("POST", data),
        auth: false,
      }
    ),

  teamMemberSenderIdentities: (memberId) =>
    request(
      `/api/team/${encode(
        memberId
      )}/sender-identities`
    ),

  setTeamMemberSenderIdentities: (
    memberId,
    senderIdentityIds
  ) =>
    request(
      `/api/team/${encode(
        memberId
      )}/sender-identities`,
      jsonOptions("PUT", {
        senderIdentityIds,
      })
    ),

  /* ------------------------------------------------------------------------ */
  /* WhatsApp                                                                 */
  /* ------------------------------------------------------------------------ */

  whatsappStatus: () =>
    request("/api/whatsapp/status"),

  whatsappConnect: () =>
    request("/api/whatsapp/connect", {
      method: "POST",
      timeoutMs: 120_000,
    }),

  whatsappLogout: () =>
    request("/api/whatsapp/logout", {
      method: "POST",
    }),

  whatsappSend: (data) =>
    request(
      "/api/whatsapp/send",
      jsonOptions("POST", data)
    ),

  /* ------------------------------------------------------------------------ */
  /* ReachFly AI                                                              */
  /* ------------------------------------------------------------------------ */

  reachflyCommand: (
    command,
    screen = {}
  ) =>
    request(
      "/api/ai/command",
      jsonOptions("POST", {
        command,
        screen,
      })
    ),

  contextualCommand: (
    command,
    screen = {}
  ) =>
    request(
      "/api/ai/contextual-command",
      jsonOptions("POST", {
        command,
        screen,
      })
    ),

  screenSuggestions: (screen = {}) =>
    request(
      "/api/ai/screen-suggestions",
      jsonOptions("POST", {
        screen,
      })
    ),


  /* ------------------------------------------------------------------------ */
  /* Automatic daily lead allocation                                          */
  /* ------------------------------------------------------------------------ */

  dailyLeadStatus: () =>
    request("/api/daily-leads/status"),

  saveDailyLeadConfig: (data) =>
    request(
      "/api/daily-leads/config",
      jsonOptions("PUT", data)
    ),

  runDailyLeadAutomation: ({ force = false } = {}) =>
    request(
      "/api/daily-leads/run",
      {
        ...jsonOptions("POST", {
          force,
        }),
        timeoutMs: 300_000,
      }
    ),

  /* ------------------------------------------------------------------------ */
  /* Caller work queue                                                        */
  /* ------------------------------------------------------------------------ */

  callerQueue: ({
    bucket = "current",
    userId = "",
    search = "",
    limit = 100,
    offset = 0,
  } = {}) =>
    request(
      withQuery("/api/caller-queue", {
        bucket,
        userId,
        search,
        limit,
        offset,
      })
    ),

  nextCallerLead: ({
    bucket = "current",
    userId = "",
  } = {}) =>
    request(
      withQuery("/api/caller-queue/next", {
        bucket,
        userId,
      })
    ),

  callerLeadHistory: (assignmentId) =>
    request(
      `/api/caller-queue/${encode(
        assignmentId
      )}/history`
    ),

  openCallerLead: (assignmentId) =>
    request(
      `/api/caller-queue/${encode(
        assignmentId
      )}/open`,
      {
        method: "POST",
      }
    ),

  startCallerLeadCall: (
    assignmentId,
    data = {}
  ) =>
    request(
      `/api/caller-queue/${encode(
        assignmentId
      )}/call/start`,
      jsonOptions("POST", data)
    ),

  completeCallerLeadCall: (
    assignmentId,
    data
  ) =>
    request(
      `/api/caller-queue/${encode(
        assignmentId
      )}/call/complete`,
      jsonOptions("POST", data)
    ),

  updateCallerLeadOutcome: (
    assignmentId,
    data
  ) =>
    request(
      `/api/caller-queue/${encode(
        assignmentId
      )}/outcome`,
      jsonOptions("POST", data)
    ),

  skipCallerLead: (
    assignmentId,
    data = {}
  ) =>
    request(
      `/api/caller-queue/${encode(
        assignmentId
      )}/skip`,
      jsonOptions("POST", data)
    ),

  scheduleCallerLeadCallback: (
    assignmentId,
    data
  ) =>
    request(
      `/api/caller-queue/${encode(
        assignmentId
      )}/callback`,
      jsonOptions("POST", data)
    ),

  /* ------------------------------------------------------------------------ */
  /* Telnyx browser dialer and call recordings                                */
  /* ------------------------------------------------------------------------ */

  telnyxDiagnostics: () =>
    request("/api/telnyx/diagnostics"),

  telnyxSession: () =>
    request("/api/telnyx/session", {
      timeoutMs: 60_000,
    }),

  telnyxDialers: () =>
    request("/api/telnyx/dialers"),

  provisionTelnyxDialers: () =>
    request("/api/telnyx/dialers/provision", {
      method: "POST",
      timeoutMs: 180_000,
    }),

  createTelnyxCall: (data) =>
    request(
      "/api/telnyx/calls",
      jsonOptions("POST", data)
    ),

  telnyxCalls: (filters = {}) =>
    request(
      withQuery("/api/telnyx/calls", filters)
    ),

  telnyxCall: (callId) =>
    request(
      `/api/telnyx/calls/${encode(callId)}`
    ),

  linkTelnyxCall: (callId, data) =>
    request(
      `/api/telnyx/calls/${encode(callId)}/link`,
      jsonOptions("PATCH", data)
    ),

  updateTelnyxCallState: (callId, data) =>
    request(
      `/api/telnyx/calls/${encode(callId)}/state`,
      jsonOptions("PATCH", data)
    ),

  completeTelnyxCall: (callId, data = {}) =>
    request(
      `/api/telnyx/calls/${encode(callId)}/complete`,
      jsonOptions("PATCH", data)
    ),

  telnyxRecordingUrl: (callId) =>
    buildUrl(
      `/api/telnyx/recordings/${encode(callId)}`
    ),

  telnyxContactPolicy: (lead = {}) =>
    request(
      withQuery("/api/telnyx/contact-policy", {
        lead: JSON.stringify(lead),
      })
    ),

  /* ------------------------------------------------------------------------ */
  /* Application settings                                                     */
  /* ------------------------------------------------------------------------ */

  appSettings: () =>
    request("/api/settings/app"),

  saveAppSettings: (data) =>
    request(
      "/api/settings/app",
      jsonOptions("PUT", data)
    ),
};

/**
 * Compatibility export required by upgraded components such as:
 *
 * CampaignTeamAssignment.jsx
 *
 * Both names reference the same API object.
 */
export const upgradeApi = api;

export default api;