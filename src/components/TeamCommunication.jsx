import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  apiRequest,
  joinConversation,
  leaveConversation,
  onWorkspaceSocket,
  sendTypingIndicator,
  sendWebRtcSignal,
  uploadFile,
} from "../lib/workspace-platform-client.js";

import "../styles.css";

const EMPTY_TASK = {
  title: "",
  description: "",
  assigneeId: "",
  priority: "normal",
  dueAt: "",
  assignmentId: "",
};

const EMPTY_GROUP = {
  name: "",
  description: "",
  memberIds: [],
};

const TASK_STATUSES = [
  "assigned",
  "in_progress",
  "blocked",
  "completed",
  "cancelled",
];

const TEAM_CACHE_VERSION = 3;
const TEAM_CACHE_TTL_MS =
  10 * 60 * 1000;
const TEAM_MESSAGE_LIMIT = 150;

function getTeamCacheKey(userId) {
  return [
    "reachfly",
    "team-communication",
    TEAM_CACHE_VERSION,
    userId || "anonymous",
  ].join(":");
}

function readTeamCommunicationCache(
  userId
) {
  if (
    typeof window === "undefined"
  ) {
    return null;
  }

  try {
    const raw =
      window.sessionStorage.getItem(
        getTeamCacheKey(userId)
      );

    if (!raw) {
      return null;
    }

    const parsed =
      JSON.parse(raw);

    if (
      !parsed ||
      Date.now() -
        Number(parsed.updatedAt || 0) >
        TEAM_CACHE_TTL_MS
    ) {
      return null;
    }

    return {
      channels:
        Array.isArray(parsed.channels)
          ? parsed.channels
          : [],
      tasks:
        Array.isArray(parsed.tasks)
          ? parsed.tasks
          : [],
      presence:
        parsed.presence &&
        typeof parsed.presence ===
          "object"
          ? parsed.presence
          : {},
      profiles:
        parsed.profiles &&
        typeof parsed.profiles ===
          "object"
          ? parsed.profiles
          : {},
      activeId:
        String(
          parsed.activeId || ""
        ),
      messagesByChannel:
        parsed.messagesByChannel &&
        typeof parsed.messagesByChannel ===
          "object"
          ? parsed.messagesByChannel
          : {},
    };
  } catch {
    return null;
  }
}

function writeTeamCommunicationCache(
  userId,
  value
) {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  try {
    const messagesByChannel = {};

    for (const [
      channelId,
      channelMessages,
    ] of Object.entries(
      value?.messagesByChannel || {}
    )) {
      if (
        !Array.isArray(
          channelMessages
        )
      ) {
        continue;
      }

      messagesByChannel[channelId] =
        channelMessages.slice(
          -TEAM_MESSAGE_LIMIT
        );
    }

    window.sessionStorage.setItem(
      getTeamCacheKey(userId),
      JSON.stringify({
        updatedAt: Date.now(),
        channels:
          Array.isArray(
            value?.channels
          )
            ? value.channels
            : [],
        tasks:
          Array.isArray(
            value?.tasks
          )
            ? value.tasks
            : [],
        presence:
          value?.presence &&
          typeof value.presence ===
            "object"
            ? value.presence
            : {},
        profiles:
          value?.profiles &&
          typeof value.profiles ===
            "object"
            ? value.profiles
            : {},
        activeId:
          value?.activeId || "",
        messagesByChannel,
      })
    );
  } catch {
    // Cache failures must never block communication.
  }
}

export default function TeamCommunication({
  user,
  members = [],
  assignments = [],
}) {
  const role = normalizeRole(
    user?.workspaceRole ||
      user?.role ||
      "caller"
  );

  const canManage = [
    "owner",
    "admin",
    "manager",
  ].includes(role);

  const canCreateGroups = canManage;

  const initialCacheRef =
    useRef(
      readTeamCommunicationCache(
        user?.id
      )
    );

  const cachedActiveId =
    initialCacheRef.current
      ?.activeId ||
    initialCacheRef.current
      ?.channels?.[0]?.id ||
    "";

  const [mode, setMode] = useState("chat");

  const [channels, setChannels] =
    useState(
      () =>
        initialCacheRef.current
          ?.channels || []
    );

  const [activeId, setActiveId] =
    useState(
      () =>
        cachedActiveId
    );

  const [messages, setMessages] =
    useState(
      () =>
        initialCacheRef.current
          ?.messagesByChannel?.[
            cachedActiveId
          ] || []
    );

  const [tasks, setTasks] =
    useState(
      () =>
        initialCacheRef.current
          ?.tasks || []
    );

  const [presence, setPresence] =
    useState(
      () =>
        initialCacheRef.current
          ?.presence || {}
    );

  const [typingUsers, setTypingUsers] =
    useState([]);

  const [
    profileOverrides,
    setProfileOverrides,
  ] = useState(
    () =>
      initialCacheRef.current
        ?.profiles || {}
  );

  const [body, setBody] = useState("");
  const [search, setSearch] = useState("");
  const [memberSearch, setMemberSearch] = useState("");

  const [taskForm, setTaskForm] = useState(EMPTY_TASK);
  const [groupForm, setGroupForm] = useState(EMPTY_GROUP);

  const [showGroupDialog, setShowGroupDialog] = useState(false);
  const [showIncomingCall, setShowIncomingCall] = useState(false);
  const [incomingCall, setIncomingCall] = useState(null);

  const [internalCall, setInternalCall] = useState(null);
  const [callState, setCallState] = useState("idle");
  const [callMuted, setCallMuted] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(false);
  const [callError, setCallError] = useState("");

  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [
    loadingMessages,
    setLoadingMessages,
  ] = useState(
    () =>
      Boolean(
        cachedActiveId &&
        !initialCacheRef.current
          ?.messagesByChannel?.[
            cachedActiveId
          ]?.length
      )
  );
  const [recordingVoice, setRecordingVoice] = useState(false);
  const [voiceSeconds, setVoiceSeconds] = useState(0);

  const bottomRef = useRef(null);
  const typingTimerRef = useRef(null);
  const fileInputRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const voiceStreamRef = useRef(null);
  const voiceChunksRef = useRef([]);
  const voiceTimerRef = useRef(null);

  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const localStreamRef = useRef(null);

  const activeIdRef =
    useRef(cachedActiveId);

  const memberDirectoryRef =
    useRef(new Map());

  const messageCacheRef =
    useRef(
      initialCacheRef.current
        ?.messagesByChannel || {}
    );

  const refreshPromiseRef =
    useRef(null);

  const cacheWriteTimerRef =
    useRef(null);

  const memberDirectory = useMemo(() => {
    const directory = new Map();

    for (const member of [
      ...(Array.isArray(members) ? members : []),
      ...(user ? [user] : []),
    ]) {
      if (!member?.id) {
        continue;
      }

      directory.set(member.id, {
        ...(directory.get(member.id) || {}),
        ...member,
      });
    }

    for (const [memberId, profile] of Object.entries(
      profileOverrides
    )) {
      directory.set(memberId, {
        ...(directory.get(memberId) || {}),
        ...profile,
      });
    }

    return directory;
  }, [members, user, profileOverrides]);

  useEffect(() => {
    memberDirectoryRef.current =
      memberDirectory;

    setChannels(
      (current) =>
        current.map(
          (channel) =>
            hydrateChannelProfiles(
              channel,
              memberDirectory,
              user?.id
            )
        )
    );

    setMessages(
      (current) =>
        current.map(
          (message) =>
            hydrateMessageProfile(
              message,
              memberDirectory
            )
        )
    );
  }, [
    memberDirectory,
    user?.id,
  ]);

  const active =
    channels.find(
      (channel) => channel.id === activeId
    ) || channels[0] || null;

  const groupedMessages = useMemo(() => {
    return messages.map((message, index) => {
      const previous = messages[index - 1];

      const sameAuthor =
        previous &&
        getMessageAuthorId(previous) ===
          getMessageAuthorId(message);

      const currentTime = new Date(
        message.createdAt || 0
      ).getTime();

      const previousTime = new Date(
        previous?.createdAt || 0
      ).getTime();

      const closeInTime =
        previous &&
        Number.isFinite(currentTime) &&
        Number.isFinite(previousTime) &&
        Math.abs(currentTime - previousTime) <
          5 * 60 * 1000;

      return {
        ...message,
        compact: Boolean(
          sameAuthor && closeInTime
        ),
      };
    });
  }, [messages]);

  const openTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          ![
            "completed",
            "cancelled",
          ].includes(
            normalizeStatus(task.status)
          )
      ),
    [tasks]
  );

  const filteredChannels = useMemo(() => {
    const query = search
      .trim()
      .toLowerCase();

    if (!query) {
      return channels;
    }

    return channels.filter((channel) =>
      [
        channel.name,
        channel.description,
        channel.lastMessage?.body,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query)
    );
  }, [channels, search]);

  const visibleMembers = useMemo(() => {
    const query = memberSearch
      .trim()
      .toLowerCase();

    return [...memberDirectory.values()]
      .filter(
        (member) =>
          member.id !== user?.id
      )
      .filter((member) => {
        if (!query) {
          return true;
        }

        return [
          member.name,
          member.fullName,
          member.email,
          member.role,
          member.workspaceRole,
          member.jobTitle,
          member.department,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query);
      })
      .slice(0, 50);
  }, [
    memberDirectory,
    memberSearch,
    user?.id,
  ]);

  const loadChannels =
    useCallback(async () => {
      const data =
        await apiRequest(
          "/team-communication/channels",
          {
            timeoutMs: 12_000,
          }
        );

      const directory =
        memberDirectoryRef.current;

      const nextChannels = (
        data?.channels || []
      ).map((channel) =>
        hydrateChannelProfiles(
          channel,
          directory,
          user?.id
        )
      );

      setChannels(nextChannels);

      setActiveId((current) => {
        if (
          current &&
          nextChannels.some(
            (channel) =>
              channel.id === current
          )
        ) {
          return current;
        }

        return (
          nextChannels[0]?.id || ""
        );
      });

      return nextChannels;
    }, [
      user?.id,
    ]);

  const loadMessages =
    useCallback(
      async (
        channelId,
        {
          background = false,
        } = {}
      ) => {
        if (!channelId) {
          setMessages([]);
          setLoadingMessages(false);
          return [];
        }

        const cachedMessages =
          messageCacheRef.current[
            channelId
          ];

        if (
          Array.isArray(
            cachedMessages
          ) &&
          cachedMessages.length
        ) {
          setMessages(
            cachedMessages.map(
              (message) =>
                hydrateMessageProfile(
                  message,
                  memberDirectoryRef
                    .current
                )
            )
          );
        }

        if (
          !background &&
          !cachedMessages?.length
        ) {
          setLoadingMessages(true);
        }

        try {
          const data =
            await apiRequest(
              `/team-communication/channels/${encodeURIComponent(
                channelId
              )}/messages`,
              {
                query: {
                  limit:
                    TEAM_MESSAGE_LIMIT,
                },
                timeoutMs: 12_000,
              }
            );

          const nextMessages =
            (
              Array.isArray(
                data?.messages
              )
                ? data.messages
                : []
            ).map(
              (message) =>
                hydrateMessageProfile(
                  message,
                  memberDirectoryRef
                    .current
                )
            );

          messageCacheRef.current = {
            ...messageCacheRef.current,
            [channelId]:
              nextMessages.slice(
                -TEAM_MESSAGE_LIMIT
              ),
          };

          if (
            activeIdRef.current ===
            channelId
          ) {
            setMessages(
              nextMessages
            );
          }

          void apiRequest(
            `/team-communication/channels/${encodeURIComponent(
              channelId
            )}/read`,
            {
              method: "POST",
              timeoutMs: 8_000,
            }
          ).catch(() => {});

          return nextMessages;
        } catch (
          requestError
        ) {
          if (
            !cachedMessages?.length &&
            activeIdRef.current ===
              channelId
          ) {
            setError(
              requestError?.message ||
                "Messages could not be loaded."
            );
          }

          return (
            cachedMessages || []
          );
        } finally {
          if (
            activeIdRef.current ===
            channelId
          ) {
            setLoadingMessages(
              false
            );
          }
        }
      },
      []
    );

  const loadTasks =
    useCallback(async () => {
      const data =
        await apiRequest(
          "/team-communication/tasks",
          {
            timeoutMs: 12_000,
          }
        );

      const nextTasks =
        Array.isArray(data?.tasks)
          ? data.tasks
          : [];

      setTasks(nextTasks);

      return nextTasks;
    }, []);

  const loadPresence =
    useCallback(async () => {
      const data =
        await apiRequest(
          "/team-communication/presence",
          {
            timeoutMs: 10_000,
          }
        );

      const nextPresence = {};
      const nextProfiles = {};

      for (
        const item of
        data?.members || []
      ) {
        const userId =
          item?.userId ||
          item?.id;

        if (!userId) {
          continue;
        }

        const normalized = {
          ...item,
          id:
            item.id || userId,
          userId,
          status:
            item.status ||
            item.availabilityStatus ||
            "offline",
        };

        nextPresence[userId] =
          normalized;

        nextProfiles[userId] = {
          ...normalized,
          avatarUrl:
            getProfileAvatar(
              normalized
            ),
        };
      }

      setPresence(
        nextPresence
      );

      setProfileOverrides(
        (current) => ({
          ...current,
          ...nextProfiles,
        })
      );

      return nextPresence;
    }, []);

  const refresh =
    useCallback(
      async ({
        silent = false,
      } = {}) => {
        if (
          refreshPromiseRef.current
        ) {
          return (
            refreshPromiseRef.current
          );
        }

        if (!silent) {
          setError("");
        }

        const promise =
          Promise.allSettled([
            loadChannels(),
            loadTasks(),
            loadPresence(),
          ])
            .then((results) => {
              const failures =
                results.filter(
                  (result) =>
                    result.status ===
                    "rejected"
                );

              if (
                failures.length ===
                results.length
              ) {
                throw (
                  failures[0]
                    ?.reason ||
                  new Error(
                    "Team communication could not be loaded."
                  )
                );
              }

              return results;
            })
            .catch(
              (requestError) => {
                setError(
                  requestError
                    ?.message ||
                    "Team communication could not be loaded."
                );
              }
            )
            .finally(() => {
              refreshPromiseRef.current =
                null;
            });

        refreshPromiseRef.current =
          promise;

        return promise;
      },
      [
        loadChannels,
        loadPresence,
        loadTasks,
      ]
    );

  useEffect(() => {
    void refresh({
      silent:
        Boolean(
          initialCacheRef.current
        ),
    });

    const refreshWhenVisible =
      () => {
        if (
          document.visibilityState ===
          "visible"
        ) {
          void refresh({
            silent: true,
          });
        }
      };

    const intervalId =
      window.setInterval(
        refreshWhenVisible,
        30_000
      );

    window.addEventListener(
      "focus",
      refreshWhenVisible
    );

    document.addEventListener(
      "visibilitychange",
      refreshWhenVisible
    );

    return () => {
      window.clearInterval(
        intervalId
      );

      window.removeEventListener(
        "focus",
        refreshWhenVisible
      );

      document.removeEventListener(
        "visibilitychange",
        refreshWhenVisible
      );
    };
  }, [
    refresh,
  ]);

  useEffect(() => {
    const cached =
      readTeamCommunicationCache(
        user?.id
      );

    if (!cached) {
      return;
    }

    messageCacheRef.current =
      cached.messagesByChannel ||
      {};

    setChannels(
      cached.channels || []
    );
    setTasks(
      cached.tasks || []
    );
    setPresence(
      cached.presence || {}
    );
    setProfileOverrides(
      cached.profiles || {}
    );

    const nextActiveId =
      cached.activeId ||
      cached.channels?.[0]?.id ||
      "";

    setActiveId(
      nextActiveId
    );

    setMessages(
      cached.messagesByChannel?.[
        nextActiveId
      ] || []
    );
  }, [
    user?.id,
  ]);

  useEffect(() => {
    return () => {
      stopVoiceRecorderTracks();
      window.clearInterval(voiceTimerRef.current);
    };
  }, []);

  useEffect(() => {
    activeIdRef.current =
      activeId;

    if (!activeId) {
      setMessages([]);
      setLoadingMessages(false);
      return undefined;
    }

    const cachedMessages =
      messageCacheRef.current[
        activeId
      ];

    if (
      Array.isArray(
        cachedMessages
      )
    ) {
      setMessages(
        cachedMessages.map(
          (message) =>
            hydrateMessageProfile(
              message,
              memberDirectoryRef
                .current
            )
        )
      );
    } else {
      setMessages([]);
    }

    void loadMessages(
      activeId,
      {
        background:
          Boolean(
            cachedMessages?.length
          ),
      }
    );

    void joinConversation(
      activeId
    ).catch(() => {});

    return () => {
      void leaveConversation(
        activeId
      ).catch(() => {});
    };
  }, [
    activeId,
    loadMessages,
  ]);

  useEffect(() => {
    bottomRef.current
      ?.scrollIntoView({
        behavior:
          loadingMessages
            ? "auto"
            : "smooth",
        block: "end",
      });
  }, [
    loadingMessages,
    messages.length,
    typingUsers.length,
  ]);

  useEffect(() => {
    if (activeId) {
      messageCacheRef.current = {
        ...messageCacheRef.current,
        [activeId]:
          messages.slice(
            -TEAM_MESSAGE_LIMIT
          ),
      };
    }

    window.clearTimeout(
      cacheWriteTimerRef.current
    );

    cacheWriteTimerRef.current =
      window.setTimeout(() => {
        writeTeamCommunicationCache(
          user?.id,
          {
            channels,
            tasks,
            presence,
            profiles:
              profileOverrides,
            activeId,
            messagesByChannel:
              messageCacheRef.current,
          }
        );
      }, 120);

    return () => {
      window.clearTimeout(
        cacheWriteTimerRef.current
      );
    };
  }, [
    activeId,
    channels,
    messages,
    presence,
    profileOverrides,
    tasks,
    user?.id,
  ]);

  useEffect(() => {
    const subscriptions = [
      onWorkspaceSocket(
        "chat:message-created",
        (event) => {
          const rawMessage =
            event.message || event;

          const message =
            hydrateMessageProfile(
              rawMessage,
              memberDirectoryRef
                .current
            );

          if (
            message.channelId === activeId
          ) {
            setMessages((current) =>
              upsertById(
                current,
                message
              )
            );

            messageCacheRef.current = {
              ...messageCacheRef.current,
              [activeId]:
                upsertById(
                  messageCacheRef
                    .current[
                      activeId
                    ] || [],
                  message
                ).slice(
                  -TEAM_MESSAGE_LIMIT
                ),
            };

            void apiRequest(
              `/team-communication/channels/${encodeURIComponent(
                activeId
              )}/read`,
              {
                method: "POST",
              }
            ).catch(() => {});
          }

          setChannels((current) =>
            current.map((channel) =>
              channel.id ===
              message.channelId
                ? {
                    ...channel,
                    lastMessage: message,
                    unreadCount:
                      message.channelId ===
                        activeId ||
                      message.userId ===
                        user?.id
                        ? 0
                        : Number(
                            channel.unreadCount ||
                              0
                          ) + 1,
                  }
                : channel
            )
          );
        }
      ),

      onWorkspaceSocket(
        "chat:channel-created",
        (event) => {
          const channel =
            event.channel || event;

          setChannels((current) =>
            upsertById(
              current,
              channel
            )
          );
        }
      ),

      onWorkspaceSocket(
        "chat:channel-updated",
        (event) => {
          const channel =
            event.channel || event;

          setChannels((current) =>
            upsertById(
              current,
              channel
            )
          );
        }
      ),

      onWorkspaceSocket(
        "chat:typing",
        (event) => {
          if (
            event.channelId !==
              activeId ||
            event.userId === user?.id
          ) {
            return;
          }

          setTypingUsers((current) => {
            const withoutUser =
              current.filter(
                (item) =>
                  item.userId !==
                  event.userId
              );

            return event.typing
              ? [
                  ...withoutUser,
                  {
                    userId:
                      event.userId,
                    name:
                      event.name ||
                      "Team member",
                  },
                ]
              : withoutUser;
          });
        }
      ),

      onWorkspaceSocket(
        "presence:updated",
        (event) => {
          const userId =
            event.userId ||
            event.member?.id;

          if (!userId) {
            return;
          }

          setPresence((current) => ({
            ...current,
            [userId]: {
              ...(typeof current[userId] === "object" ? current[userId] : {}),
              ...event,
              ...(event.member || {}),
              status:
                event.status ||
                event.availabilityStatus ||
                event.member?.availabilityStatus ||
                "offline",
              avatarUrl:
                event.avatarUrl ||
                event.member?.avatarUrl ||
                (typeof current[userId] === "object" ? current[userId].avatarUrl : "") ||
                "",
            },
          }));
        }
      ),

      onWorkspaceSocket(
        "team:task-created",
        (event) => {
          setTasks((current) =>
            upsertById(
              current,
              event.task || event
            )
          );
        }
      ),

      onWorkspaceSocket(
        "team:task-updated",
        (event) => {
          setTasks((current) =>
            upsertById(
              current,
              event.task || event
            )
          );
        }
      ),

      onWorkspaceSocket(
        "profile:updated",
        (event) => {
          applyProfileUpdate(
            event?.profile ||
              event?.user ||
              event
          );
        }
      ),

      onWorkspaceSocket(
        "profile:avatar-updated",
        (event) => {
          applyProfileUpdate({
            ...(event?.profile ||
              event?.user ||
              {}),
            id:
              event?.userId ||
              event?.profile?.id ||
              event?.user?.id,
            avatarUrl:
              event?.avatarUrl ||
              getProfileAvatar(
                event?.profile ||
                  event?.user
              ),
          });
        }
      ),

      onWorkspaceSocket(
        "internal-call:incoming",
        (event) => {
          setIncomingCall(event);
          setShowIncomingCall(true);
        }
      ),

      onWorkspaceSocket(
        "internal-call:accepted",
        handleInternalCallAccepted
      ),

      onWorkspaceSocket(
        "internal-call:rejected",
        handleInternalCallRejected
      ),

      onWorkspaceSocket(
        "internal-call:ended",
        handleInternalCallEnded
      ),

      onWorkspaceSocket(
        "internal-call:signal",
        handleWebRtcSignal
      ),
    ];

    return () => {
      subscriptions.forEach(
        (unsubscribe) =>
          unsubscribe()
      );
    };
  }, [
    activeId,
    user?.id,
    internalCall?.id,
  ]);

  function applyProfileUpdate(
    updatedProfile
  ) {
    if (!updatedProfile?.id) {
      return;
    }

    const normalizedProfile = {
      ...updatedProfile,
      avatarUrl:
        getProfileAvatar(updatedProfile),
    };

    setProfileOverrides((current) => ({
      ...current,
      [normalizedProfile.id]: {
        ...(current[normalizedProfile.id] || {}),
        ...normalizedProfile,
      },
    }));

    setChannels((current) =>
      current.map((channel) => ({
        ...channel,

        otherMember:
          channel.otherMember?.id ===
          normalizedProfile.id
            ? {
                ...channel.otherMember,
                ...normalizedProfile,
              }
            : channel.otherMember,

        members: Array.isArray(
          channel.members
        )
          ? channel.members.map(
              (member) =>
                member.id ===
                normalizedProfile.id
                  ? {
                      ...member,
                      ...normalizedProfile,
                    }
                  : member
            )
          : channel.members,
      }))
    );

    setMessages((current) =>
      current.map((message) => {
        const authorId =
          getMessageAuthorId(
            message
          );

        if (
          authorId !==
          normalizedProfile.id
        ) {
          return message;
        }

        const avatarUrl =
          getProfileAvatar(
            updatedProfile
          );

        return {
          ...message,

          authorName:
            normalizedProfile.name ||
            normalizedProfile.fullName ||
            message.authorName,

          authorRole:
            normalizedProfile.workspaceRole ||
            normalizedProfile.role ||
            message.authorRole,

          authorAvatarUrl:
            avatarUrl ||
            message.authorAvatarUrl,

          user: {
            ...(message.user || {}),
            ...normalizedProfile,
            avatarUrl:
              avatarUrl ||
              message.user?.avatarUrl ||
              "",
          },
        };
      })
    );
  }

  async function send() {
    const text = body.trim();

    if (!text || !activeId) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response =
        await apiRequest(
          `/team-communication/channels/${encodeURIComponent(
            activeId
          )}/messages`,
          {
            method: "POST",
            body: {
              body: text,
              type: "text",
            },
          }
        );

      const message =
        response.message ||
        response;

      setMessages((current) =>
        upsertById(
          current,
          message
        )
      );

      setBody("");

      void sendTypingIndicator({
        conversationId: activeId,
        typing: false,
      }).catch(() => {});
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The message could not be sent."
      );
    } finally {
      setBusy(false);
    }
  }

  function handleBodyChange(value) {
    setBody(value);

    if (!activeId) {
      return;
    }

    void sendTypingIndicator({
      conversationId: activeId,
      typing: true,
    }).catch(() => {});

    window.clearTimeout(
      typingTimerRef.current
    );

    typingTimerRef.current =
      window.setTimeout(() => {
        void sendTypingIndicator({
          conversationId: activeId,
          typing: false,
        }).catch(() => {});
      }, 1200);
  }

  async function createDirect(member) {
    setBusy(true);
    setError("");

    try {
      const response =
        await apiRequest(
          "/team-communication/channels",
          {
            method: "POST",
            body: {
              type: "direct",
              name:
                member.name ||
                member.email,
              memberIds: [
                member.id,
              ],
            },
          }
        );

      const channel =
        response.channel ||
        response;

      setChannels((current) =>
        upsertById(
          current,
          channel
        )
      );

      setActiveId(channel.id);
      setMode("chat");
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The direct conversation could not be created."
      );
    } finally {
      setBusy(false);
    }
  }

  async function createGroup() {
    if (
      !groupForm.name.trim() ||
      groupForm.memberIds.length < 1
    ) {
      return;
    }

    setBusy(true);
    setError("");

    try {
      const response =
        await apiRequest(
          "/team-communication/channels",
          {
            method: "POST",
            body: {
              type: "group",
              name:
                groupForm.name.trim(),
              description:
                groupForm.description.trim(),
              memberIds:
                groupForm.memberIds,
            },
          }
        );

      const channel =
        response.channel ||
        response;

      setChannels((current) =>
        upsertById(
          current,
          channel
        )
      );

      setActiveId(channel.id);
      setShowGroupDialog(false);
      setGroupForm(EMPTY_GROUP);
      setMode("chat");
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The group conversation could not be created."
      );
    } finally {
      setBusy(false);
    }
  }

  async function createTask() {
    const assignment =
      assignments.find(
        (item) =>
          item.id ===
          taskForm.assignmentId
      );

    setBusy(true);
    setError("");

    try {
      const response =
        await apiRequest(
          "/team-communication/tasks",
          {
            method: "POST",
            body: {
              ...taskForm,
              dueAt:
                taskForm.dueAt
                  ? new Date(
                      taskForm.dueAt
                    ).toISOString()
                  : null,
              lead:
                assignment?.lead ||
                {},
              leadId:
                assignment?.leadId ||
                assignment?.lead?.id ||
                "",
              campaignId:
                assignment?.campaignId ||
                "",
            },
          }
        );

      const task =
        response.task ||
        response;

      setTasks((current) =>
        upsertById(
          current,
          task
        )
      );

      setTaskForm(EMPTY_TASK);
      setMode("tasks");
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The work assignment could not be created."
      );
    } finally {
      setBusy(false);
    }
  }

  async function updateTask(
    task,
    status
  ) {
    try {
      const response =
        await apiRequest(
          `/team-communication/tasks/${encodeURIComponent(
            task.id
          )}`,
          {
            method: "PATCH",
            body: {
              status,
            },
          }
        );

      setTasks((current) =>
        upsertById(
          current,
          response.task ||
            response
        )
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The work assignment could not be updated."
      );
    }
  }

  async function uploadAttachment(
    event
  ) {
    const file =
      event.target.files?.[0];

    event.target.value = "";

    if (!file || !activeId) {
      return;
    }

    setUploading(true);
    setError("");

    try {
      const response =
        await uploadFile(
          `/team-communication/channels/${encodeURIComponent(
            activeId
          )}/attachments`,
          {
            file,
            fieldName: "file",
            fields: {
              channelId: activeId,
            },
          }
        );

      const attachment =
        response.attachment ||
        response.file ||
        response;

      const messageResponse =
        await apiRequest(
          `/team-communication/channels/${encodeURIComponent(
            activeId
          )}/messages`,
          {
            method: "POST",
            body: {
              type:
                file.type.startsWith(
                  "image/"
                )
                  ? "image"
                  : "file",
              body: file.name,
              attachments: [
                attachment,
              ],
            },
          }
        );

      setMessages((current) =>
        upsertById(
          current,
          messageResponse.message ||
            messageResponse
        )
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The attachment could not be uploaded."
      );
    } finally {
      setUploading(false);
    }
  }

  async function startVoiceRecording() {
    if (
      recordingVoice ||
      !activeId
    ) {
      return;
    }

    setError("");

    try {
      const stream =
        await requestCallMedia({
          video: false,
        });

      if (
        typeof MediaRecorder ===
        "undefined"
      ) {
        stream
          .getTracks()
          .forEach((track) =>
            track.stop()
          );

        throw new Error(
          "Voice recording is not supported by this browser."
        );
      }

      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/ogg;codecs=opus",
        "audio/mp4",
      ];

      const mimeType =
        preferredTypes.find(
          (type) =>
            MediaRecorder.isTypeSupported?.(
              type
            )
        ) || "";

      const recorder =
        new MediaRecorder(
          stream,
          mimeType
            ? {
                mimeType,
              }
            : undefined
        );

      voiceStreamRef.current =
        stream;

      mediaRecorderRef.current =
        recorder;

      voiceChunksRef.current =
        [];

      recorder.ondataavailable =
        (event) => {
          if (
            event.data &&
            event.data.size > 0
          ) {
            voiceChunksRef.current.push(
              event.data
            );
          }
        };

      recorder.onerror = () => {
        setError(
          "The voice message could not be recorded."
        );

        stopVoiceRecorderTracks();
        setRecordingVoice(false);
      };

      recorder.onstop = () => {
        void uploadRecordedVoice(
          recorder.mimeType ||
            mimeType ||
            "audio/webm"
        );
      };

      recorder.start(250);

      setVoiceSeconds(0);
      setRecordingVoice(true);

      window.clearInterval(
        voiceTimerRef.current
      );

      voiceTimerRef.current =
        window.setInterval(() => {
          setVoiceSeconds(
            (current) =>
              current + 1
          );
        }, 1000);
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The microphone could not be started."
      );
    }
  }

  function stopVoiceRecording() {
    const recorder =
      mediaRecorderRef.current;

    if (
      !recorder ||
      recorder.state ===
        "inactive"
    ) {
      return;
    }

    window.clearInterval(
      voiceTimerRef.current
    );

    recorder.stop();
    setRecordingVoice(false);
  }

  function cancelVoiceRecording() {
    const recorder =
      mediaRecorderRef.current;

    voiceChunksRef.current = [];

    if (
      recorder &&
      recorder.state !==
        "inactive"
    ) {
      recorder.onstop = () => {
        stopVoiceRecorderTracks();
      };

      recorder.stop();
    } else {
      stopVoiceRecorderTracks();
    }

    window.clearInterval(
      voiceTimerRef.current
    );

    setVoiceSeconds(0);
    setRecordingVoice(false);
  }

  function stopVoiceRecorderTracks() {
    for (const track of
      voiceStreamRef.current?.getTracks() ||
      []) {
      track.stop();
    }

    voiceStreamRef.current =
      null;

    mediaRecorderRef.current =
      null;
  }

  async function uploadRecordedVoice(
    mimeType
  ) {
    const chunks =
      voiceChunksRef.current;

    voiceChunksRef.current =
      [];

    stopVoiceRecorderTracks();
    window.clearInterval(
      voiceTimerRef.current
    );

    if (
      !chunks.length ||
      !activeId
    ) {
      setVoiceSeconds(0);
      return;
    }

    const blob = new Blob(
      chunks,
      {
        type: mimeType,
      }
    );

    if (!blob.size) {
      setVoiceSeconds(0);
      return;
    }

    const extension =
      mimeType.includes("ogg")
        ? "ogg"
        : mimeType.includes("mp4")
          ? "m4a"
          : "webm";

    const file = new File(
      [blob],
      `voice-message-${Date.now()}.${extension}`,
      {
        type: mimeType,
      }
    );

    setUploading(true);
    setError("");

    try {
      const response =
        await uploadFile(
          `/team-communication/channels/${encodeURIComponent(
            activeId
          )}/attachments`,
          {
            file,
            fieldName: "file",
            fields: {
              channelId:
                activeId,
              kind:
                "voice",
              durationSeconds:
                String(
                  voiceSeconds
                ),
            },
          }
        );

      const attachment =
        response.attachment ||
        response.file ||
        response;

      const messageResponse =
        await apiRequest(
          `/team-communication/channels/${encodeURIComponent(
            activeId
          )}/messages`,
          {
            method: "POST",
            body: {
              type: "voice",
              body:
                "Voice message",
              attachments: [
                {
                  ...attachment,
                  kind: "voice",
                  durationSeconds:
                    voiceSeconds,
                },
              ],
              metadata: {
                durationSeconds:
                  voiceSeconds,
              },
            },
          }
        );

      setMessages((current) =>
        upsertById(
          current,
          messageResponse.message ||
            messageResponse
        )
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The voice message could not be sent."
      );
    } finally {
      setUploading(false);
      setVoiceSeconds(0);
    }
  }

  async function shareAssignment(
    assignment
  ) {
    if (!activeId) {
      return;
    }

    const lead =
      assignment.lead || {};

    try {
      const response =
        await apiRequest(
          `/team-communication/channels/${encodeURIComponent(
            activeId
          )}/messages`,
          {
            method: "POST",
            body: {
              type: "lead",
              body:
                lead.business ||
                lead.name ||
                "Shared lead",
              metadata: {
                assignmentId:
                  assignment.id,
                leadId:
                  assignment.leadId ||
                  lead.id,
                lead,
              },
            },
          }
        );

      setMessages((current) =>
        upsertById(
          current,
          response.message ||
            response
        )
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The lead could not be shared."
      );
    }
  }

  async function startInternalCall(
    member,
    {
      video = false,
    } = {}
  ) {
    setCallError("");

    try {
      const stream =
        await requestCallMedia({
          video,
        });

      localStreamRef.current =
        stream;

      attachLocalStream(stream);

      const response =
        await apiRequest(
          "/team-communication/internal-calls",
          {
            method: "POST",
            body: {
              targetUserId:
                member.id,
              type:
                video
                  ? "video"
                  : "audio",
              channelId:
                active?.id ||
                null,
            },
          }
        );

      const call =
        response.call ||
        response;

      setInternalCall(call);
      setCallState("calling");
      setCameraEnabled(video);

      const peer =
        createPeerConnection({
          callId: call.id,
          targetUserId:
            member.id,
        });

      peerConnectionRef.current =
        peer;

      for (const track of stream.getTracks()) {
        peer.addTrack(track, stream);
      }

      const offer =
        await peer.createOffer();

      await peer.setLocalDescription(
        offer
      );

      await sendWebRtcSignal({
        targetUserId:
          member.id,
        callId: call.id,
        type: "offer",
        signal: offer,
      });
    } catch (requestError) {
      cleanupInternalCall();

      setCallError(
        requestError?.message ||
          "The internal call could not be started."
      );
    }
  }

  async function acceptIncomingCall() {
    const call = incomingCall?.call || incomingCall;

    if (!call?.id) {
      return;
    }

    setShowIncomingCall(false);
    setCallError("");

    try {
      const wantsVideo =
        call.type === "video";

      const stream =
        await requestCallMedia({
          video: wantsVideo,
        });

      localStreamRef.current =
        stream;

      attachLocalStream(stream);

      setInternalCall(call);
      setCallState("connecting");
      setCameraEnabled(wantsVideo);

      const peer =
        createPeerConnection({
          callId: call.id,
          targetUserId:
            call.callerUserId ||
            call.fromUserId,
        });

      peerConnectionRef.current =
        peer;

      for (const track of stream.getTracks()) {
        peer.addTrack(track, stream);
      }

      await apiRequest(
        `/team-communication/internal-calls/${encodeURIComponent(
          call.id
        )}/accept`,
        {
          method: "POST",
        }
      );

      if (call.offer) {
        await peer.setRemoteDescription(
          call.offer
        );

        const answer =
          await peer.createAnswer();

        await peer.setLocalDescription(
          answer
        );

        await sendWebRtcSignal({
          targetUserId:
            call.callerUserId ||
            call.fromUserId,
          callId: call.id,
          type: "answer",
          signal: answer,
        });
      }
    } catch (requestError) {
      cleanupInternalCall();

      setCallError(
        requestError?.message ||
          "The incoming call could not be accepted."
      );
    }
  }

  async function rejectIncomingCall() {
    const call = incomingCall?.call || incomingCall;

    setShowIncomingCall(false);
    setIncomingCall(null);

    if (!call?.id) {
      return;
    }

    await apiRequest(
      `/team-communication/internal-calls/${encodeURIComponent(
        call.id
      )}/reject`,
      {
        method: "POST",
      }
    ).catch(() => {});
  }

  async function endInternalCall() {
    const callId =
      internalCall?.id;

    if (callId) {
      await apiRequest(
        `/team-communication/internal-calls/${encodeURIComponent(
          callId
        )}/end`,
        {
          method: "POST",
        }
      ).catch(() => {});
    }

    cleanupInternalCall();
  }

  function toggleCallMute() {
    const nextMuted = !callMuted;

    setCallMuted(nextMuted);

    for (const track of
      localStreamRef.current?.getAudioTracks() ||
      []) {
      track.enabled = !nextMuted;
    }
  }

  function toggleCamera() {
    const nextEnabled =
      !cameraEnabled;

    setCameraEnabled(
      nextEnabled
    );

    for (const track of
      localStreamRef.current?.getVideoTracks() ||
      []) {
      track.enabled = nextEnabled;
    }
  }

  function handleInternalCallAccepted(
    event
  ) {
    const call =
      event.call || event;

    if (
      internalCall?.id &&
      call.id !== internalCall.id
    ) {
      return;
    }

    setInternalCall((current) => ({
      ...(current || {}),
      ...call,
    }));

    setCallState("connected");
  }

  function handleInternalCallRejected(
    event
  ) {
    const call =
      event.call || event;

    if (
      internalCall?.id &&
      call.id !== internalCall.id
    ) {
      return;
    }

    setCallError(
      "The team member declined the call."
    );

    cleanupInternalCall();
  }

  function handleInternalCallEnded(
    event
  ) {
    const call =
      event.call || event;

    if (
      internalCall?.id &&
      call.id !== internalCall.id
    ) {
      return;
    }

    cleanupInternalCall();
  }

  async function handleWebRtcSignal(
    event
  ) {
    const callId =
      event.callId ||
      event.call?.id;

    if (
      internalCall?.id &&
      callId !== internalCall.id
    ) {
      return;
    }

    const peer =
      peerConnectionRef.current;

    if (!peer) {
      return;
    }

    try {
      if (event.type === "offer") {
        await peer.setRemoteDescription(
          event.signal
        );

        const answer =
          await peer.createAnswer();

        await peer.setLocalDescription(
          answer
        );

        await sendWebRtcSignal({
          targetUserId:
            event.fromUserId,
          callId,
          type: "answer",
          signal: answer,
        });
      } else if (
        event.type === "answer"
      ) {
        await peer.setRemoteDescription(
          event.signal
        );

        setCallState("connected");
      } else if (
        event.type === "candidate" &&
        event.signal
      ) {
        await peer.addIceCandidate(
          event.signal
        );
      }
    } catch (signalError) {
      setCallError(
        signalError?.message ||
          "The internal call connection failed."
      );
    }
  }

  function createPeerConnection({
    callId,
    targetUserId,
  }) {
    const peer =
      new RTCPeerConnection({
        iceServers: [
          {
            urls:
              "stun:stun.l.google.com:19302",
          },
        ],
      });

    peer.onicecandidate = (
      event
    ) => {
      if (!event.candidate) {
        return;
      }

      void sendWebRtcSignal({
        targetUserId,
        callId,
        type: "candidate",
        signal: event.candidate,
      }).catch(() => {});
    };

    peer.ontrack = (event) => {
      if (
        remoteVideoRef.current &&
        event.streams?.[0]
      ) {
        remoteVideoRef.current.srcObject =
          event.streams[0];

        void remoteVideoRef.current
          .play()
          .catch(() => {});
      }
    };

    peer.onconnectionstatechange =
      () => {
        if (
          [
            "failed",
            "closed",
            "disconnected",
          ].includes(
            peer.connectionState
          )
        ) {
          cleanupInternalCall();
        } else if (
          peer.connectionState ===
          "connected"
        ) {
          setCallState("connected");
        }
      };

    return peer;
  }

  function attachLocalStream(stream) {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject =
        stream;

      void localVideoRef.current
        .play()
        .catch(() => {});
    }
  }

  function cleanupInternalCall() {
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;

    for (const track of
      localStreamRef.current?.getTracks() ||
      []) {
      track.stop();
    }

    localStreamRef.current = null;

    if (localVideoRef.current) {
      localVideoRef.current.srcObject =
        null;
    }

    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject =
        null;
    }

    setInternalCall(null);
    setIncomingCall(null);
    setCallState("idle");
    setCallMuted(false);
    setCameraEnabled(false);
  }

  return (
    <section className="team-comms-shell">
      <header className="team-comms-header">
        <div>
          <span>
            Internal operations
          </span>

          <h2>
            Team communication and work assignments
          </h2>

          <p>
            Coordinate outreach, preserve lead history,
            and maintain an accountable record of every
            assignment and internal conversation.
          </p>
        </div>

        <div className="team-comms-switch">
          <button
            type="button"
            className={
              mode === "chat"
                ? "active"
                : ""
            }
            onClick={() =>
              setMode("chat")
            }
          >
            Communication
          </button>

          <button
            type="button"
            className={
              mode === "tasks"
                ? "active"
                : ""
            }
            onClick={() =>
              setMode("tasks")
            }
          >
            Work assignments
            <b>{openTasks.length}</b>
          </button>
        </div>
      </header>

      {error ? (
        <div className="team-comms-error">
          <span>{error}</span>

          <button
            type="button"
            onClick={() =>
              setError("")
            }
          >
            Close
          </button>
        </div>
      ) : null}

      {callError ? (
        <div className="team-comms-error">
          <span>{callError}</span>

          <button
            type="button"
            onClick={() =>
              setCallError("")
            }
          >
            Close
          </button>
        </div>
      ) : null}

      {mode === "chat" ? (
        <div className="team-chat-layout">
          <aside className="team-channel-list">
            <div className="team-channel-title">
              <div>
                <b>Channels</b>

                <small>
                  {channels.reduce(
                    (total, channel) =>
                      total +
                      Number(
                        channel.unreadCount ||
                          0
                      ),
                    0
                  )}{" "}
                  unread
                </small>
              </div>

              {canCreateGroups ? (
                <button
                  type="button"
                  title="Create group"
                  onClick={() =>
                    setShowGroupDialog(
                      true
                    )
                  }
                >
                  +
                </button>
              ) : null}
            </div>

            <label className="team-comms-search">
              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search conversations…"
              />
            </label>

            <div className="team-channel-scroll">
              {filteredChannels.map(
                (channel) => (
                  <button
                    key={channel.id}
                    type="button"
                    className={
                      active?.id ===
                      channel.id
                        ? "active"
                        : ""
                    }
                    onClick={() =>
                      setActiveId(
                        channel.id
                      )
                    }
                  >
                    <ChannelAvatar
                      channel={channel}
                    />

                    <span>
                      <b>
                        {channel.name}
                      </b>

                      <small>
                        {channel.lastMessage
                          ?.body ||
                          channel.description ||
                          "No messages yet"}
                      </small>
                    </span>

                    {channel.unreadCount ? (
                      <em>
                        {channel.unreadCount}
                      </em>
                    ) : null}
                  </button>
                )
              )}
            </div>

            <div className="team-direct-title">
              <span>
                Start a conversation
              </span>
            </div>

            <label className="team-comms-search">
              <input
                value={memberSearch}
                onChange={(event) =>
                  setMemberSearch(
                    event.target.value
                  )
                }
                placeholder="Find a team member…"
              />
            </label>

            <div className="team-member-scroll">
              {visibleMembers.map(
                (member) => (
                  <article
                    className="team-person-row"
                    key={member.id}
                  >
                    <button
                      type="button"
                      className="direct-person"
                      onClick={() =>
                        createDirect(
                          member
                        )
                      }
                    >
                      <MemberAvatar
                        member={member}
                      />

                      <span>
                        <b>
                          {member.name ||
                            member.email}
                        </b>

                        <small>
                          {formatRole(
                            member.workspaceRole ||
                              member.role ||
                              "team member"
                          )}
                          {" · "}
                          {formatPresenceText(
                            presence[
                              member.id
                            ] ||
                              member
                          )}
                        </small>
                      </span>

                      <PresenceDot
                        status={
                          presence[
                            member.id
                          ] ||
                          member.availabilityStatus ||
                          "offline"
                        }
                      />
                    </button>

                    <div className="team-person-actions">
                      <button
                        type="button"
                        title="Start audio call"
                        onClick={() =>
                          startInternalCall(
                            member
                          )
                        }
                      >
                        ☎
                      </button>

                      <button
                        type="button"
                        title="Start video call"
                        onClick={() =>
                          startInternalCall(
                            member,
                            {
                              video: true,
                            }
                          )
                        }
                      >
                        ◉
                      </button>
                    </div>
                  </article>
                )
              )}
            </div>
          </aside>

          <main className="team-message-panel">
            <header>
              <div className="team-message-header-main">
                {active ? (
                  <ChannelAvatar
                    channel={active}
                    large
                  />
                ) : null}

                <div>
                  <small>
                    {active?.type ===
                    "direct"
                      ? "Direct conversation"
                      : "Team channel"}
                  </small>

                  <h3>
                    {active?.name ||
                      "Communication"}
                  </h3>

                  <span className="team-channel-subtitle">
                    {active?.type === "direct"
                      ? formatPresenceText(
                          presence[
                            active?.otherMember?.id
                          ] ||
                            active?.otherMember ||
                            "offline"
                        )
                      : `${active?.members?.length || 0} members · ${
                          active?.description ||
                          "Workspace communication"
                        }`}
                  </span>
                </div>
              </div>

              {active?.type ===
                "direct" &&
              active?.otherMember ? (
                <div className="team-header-call-actions">
                  <button
                    type="button"
                    onClick={() =>
                      startInternalCall(
                        active.otherMember
                      )
                    }
                  >
                    Audio call
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      startInternalCall(
                        active.otherMember,
                        {
                          video: true,
                        }
                      )
                    }
                  >
                    Video call
                  </button>
                </div>
              ) : null}
            </header>

            <div className="team-message-stream">
              {loadingMessages ? (
                <MessageLoadingState />
              ) : groupedMessages.length ? (
                groupedMessages.map((message) => (
                  <MessageItem
                    key={message.id}
                    message={message}
                    currentUserId={user?.id}
                    compact={message.compact}
                    onCopy={async () => {
                      await navigator.clipboard.writeText(
                        message.body || ""
                      );
                    }}
                  />
                ))
              ) : (
                <div className="team-empty">
                  <b>
                    No messages yet
                  </b>

                  <p>
                    Use this channel for concise operational updates,
                    handovers, and lead-specific context.
                  </p>
                </div>
              )}

              {typingUsers.length ? (
                <div className="team-typing">
                  <span />
                  <span />
                  <span />

                  <small>
                    {typingUsers
                      .map(
                        (item) =>
                          item.name
                      )
                      .join(", ")}{" "}
                    typing
                  </small>
                </div>
              ) : null}

              <div ref={bottomRef} />
            </div>

            <footer>
              <div className="team-message-tools">
                <button
                  type="button"
                  title="Attach file"
                  disabled={
                    uploading ||
                    !activeId
                  }
                  onClick={() =>
                    fileInputRef.current?.click()
                  }
                >
                  {uploading
                    ? "…"
                    : "＋"}
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  hidden
                  onChange={
                    uploadAttachment
                  }
                />

                {recordingVoice ? (
                  <div className="team-voice-recorder">
                    <span className="team-voice-live-dot" />

                    <strong>
                      {formatVoiceDuration(
                        voiceSeconds
                      )}
                    </strong>

                    <button
                      type="button"
                      title="Cancel voice message"
                      onClick={
                        cancelVoiceRecording
                      }
                    >
                      Cancel
                    </button>

                    <button
                      type="button"
                      title="Send voice message"
                      onClick={
                        stopVoiceRecording
                      }
                    >
                      Send
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    title="Record voice message"
                    disabled={
                      uploading ||
                      !activeId
                    }
                    onClick={() =>
                      void startVoiceRecording()
                    }
                  >
                    🎙
                  </button>
                )}

                <LeadShareMenu
                  assignments={
                    assignments
                  }
                  disabled={!activeId}
                  onShare={
                    shareAssignment
                  }
                />
              </div>

              <textarea
                value={body}
                onChange={(event) =>
                  handleBodyChange(
                    event.target.value
                  )
                }
                onKeyDown={(event) => {
                  if (
                    event.key ===
                      "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();
                    void send();
                  }
                }}
                placeholder="Write a professional team update…"
                disabled={!activeId}
              />

              <button
                type="button"
                disabled={
                  busy ||
                  !body.trim() ||
                  !activeId
                }
                onClick={() =>
                  void send()
                }
              >
                Send message
              </button>
            </footer>
          </main>
        </div>
      ) : (
        <div className="team-task-layout">
          <main className="task-board">
            <div className="task-board-head">
              <div>
                <h3>
                  Work assignment register
                </h3>

                <p>
                  Every lead-related action remains attributable,
                  time-stamped, and available for management review.
                </p>
              </div>
            </div>

            {tasks.length ? (
              tasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  currentUserId={
                    user?.id
                  }
                  canManage={
                    canManage
                  }
                  onUpdate={
                    updateTask
                  }
                />
              ))
            ) : (
              <div className="team-empty">
                <b>
                  No work assignments
                </b>

                <p>
                  Managers can create structured assignments linked
                  to a lead and a responsible caller.
                </p>
              </div>
            )}
          </main>

          {canManage ? (
            <aside className="task-editor">
              <span>
                Manager action
              </span>

              <h3>
                Create work assignment
              </h3>

              <label>
                Assignee

                <select
                  value={
                    taskForm.assigneeId
                  }
                  onChange={(event) =>
                    setTaskForm(
                      (current) => ({
                        ...current,
                        assigneeId:
                          event.target
                            .value,
                      })
                    )
                  }
                >
                  <option value="">
                    Select team member
                  </option>

                  {members
                    .filter((member) =>
                      [
                        "caller",
                        "member",
                      ].includes(
                        normalizeRole(
                          member.workspaceRole ||
                            member.role
                        )
                      )
                    )
                    .map((member) => (
                      <option
                        key={
                          member.id
                        }
                        value={
                          member.id
                        }
                      >
                        {member.name ||
                          member.email}
                      </option>
                    ))}
                </select>
              </label>

              <label>
                Related lead

                <select
                  value={
                    taskForm.assignmentId
                  }
                  onChange={(event) =>
                    setTaskForm(
                      (current) => ({
                        ...current,
                        assignmentId:
                          event.target
                            .value,
                      })
                    )
                  }
                >
                  <option value="">
                    General assignment
                  </option>

                  {assignments
                    .slice(0, 500)
                    .map(
                      (assignment) => (
                        <option
                          key={
                            assignment.id
                          }
                          value={
                            assignment.id
                          }
                        >
                          {assignment.lead
                            ?.business ||
                            assignment.lead
                              ?.name ||
                            assignment.leadId}
                        </option>
                      )
                    )}
                </select>
              </label>

              <label>
                Task title

                <input
                  value={
                    taskForm.title
                  }
                  onChange={(event) =>
                    setTaskForm(
                      (current) => ({
                        ...current,
                        title:
                          event.target
                            .value,
                      })
                    )
                  }
                  placeholder="e.g. Call and qualify the decision-maker"
                />
              </label>

              <label>
                Instructions

                <textarea
                  value={
                    taskForm.description
                  }
                  onChange={(event) =>
                    setTaskForm(
                      (current) => ({
                        ...current,
                        description:
                          event.target
                            .value,
                      })
                    )
                  }
                  placeholder="Define the expected outcome and required follow-up."
                />
              </label>

              <div className="task-form-row">
                <label>
                  Priority

                  <select
                    value={
                      taskForm.priority
                    }
                    onChange={(event) =>
                      setTaskForm(
                        (current) => ({
                          ...current,
                          priority:
                            event.target
                              .value,
                        })
                      )
                    }
                  >
                    <option value="normal">
                      Normal
                    </option>
                    <option value="high">
                      High
                    </option>
                    <option value="urgent">
                      Urgent
                    </option>
                    <option value="low">
                      Low
                    </option>
                  </select>
                </label>

                <label>
                  Due date

                  <input
                    type="datetime-local"
                    value={
                      taskForm.dueAt
                    }
                    onChange={(event) =>
                      setTaskForm(
                        (current) => ({
                          ...current,
                          dueAt:
                            event.target
                              .value,
                        })
                      )
                    }
                  />
                </label>
              </div>

              <button
                type="button"
                className="create-task-button"
                disabled={
                  busy ||
                  !taskForm.assigneeId ||
                  !taskForm.title.trim()
                }
                onClick={() =>
                  void createTask()
                }
              >
                Assign work
              </button>
            </aside>
          ) : null}
        </div>
      )}

      {showGroupDialog ? (
        <GroupDialog
          members={members}
          form={groupForm}
          busy={busy}
          onChange={setGroupForm}
          onClose={() =>
            setShowGroupDialog(
              false
            )
          }
          onSubmit={createGroup}
        />
      ) : null}

      {showIncomingCall ? (
        <IncomingCallDialog
          call={
            incomingCall?.call ||
            incomingCall
          }
          onAccept={
            acceptIncomingCall
          }
          onReject={
            rejectIncomingCall
          }
        />
      ) : null}

      {internalCall ? (
        <InternalCallOverlay
          call={internalCall}
          callState={callState}
          muted={callMuted}
          cameraEnabled={
            cameraEnabled
          }
          localVideoRef={
            localVideoRef
          }
          remoteVideoRef={
            remoteVideoRef
          }
          onToggleMute={
            toggleCallMute
          }
          onToggleCamera={
            toggleCamera
          }
          onEnd={
            endInternalCall
          }
        />
      ) : null}
    </section>
  );
}

function MessageItem({
  message,
  currentUserId,
  compact = false,
  onCopy,
}) {
  const isMine =
    getMessageAuthorId(message) ===
    currentUserId;

  const attachments =
    Array.isArray(message.attachments)
      ? message.attachments
      : [];

  return (
    <article
      className={[
        "team-message-item",
        isMine ? "mine" : "",
        compact ? "compact" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="team-message-avatar-slot">
        {!compact ? (
          <MemberAvatar
            member={{
              id:
                message.authorId ||
                message.userId ||
                message.senderId ||
                message.user?.id,

              name:
                message.authorName ||
                message.senderName ||
                message.user?.name,

              avatarUrl:
                message.authorAvatarUrl ||
                message.senderAvatar ||
                message.user?.avatarUrl,

              photoUrl:
                message.user?.photoUrl,

              profileImage:
                message.user
                  ?.profileImage,
            }}
          />
        ) : (
          <time
            className="team-compact-time"
            dateTime={message.createdAt}
          >
            {formatMessageTime(
              message.createdAt
            )}
          </time>
        )}
      </div>

      <div className="team-message-content">
        {!compact ? (
          <header className="team-message-meta">
            <strong>
              {message.authorName ||
                message.user?.name ||
                "Team member"}
            </strong>

            <span>
              {formatRole(
                message.authorRole ||
                  message.user?.role ||
                  "team member"
              )}
            </span>

            <time
              dateTime={message.createdAt}
              title={formatDateTime(
                message.createdAt
              )}
            >
              {formatMessageTime(
                message.createdAt
              )}
            </time>
          </header>
        ) : null}

        <div className="team-message-body-row">
          <div className="team-message-payload">
            {message.type === "lead" ? (
              <SharedLeadMessage
                message={message}
              />
            ) : (
              <div
                className={[
                  "team-message-text",
                  message.type === "task"
                    ? "task-message"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                {message.body}
              </div>
            )}

            {message.type === "voice" ? (
              <VoiceMessagePlayer
                message={message}
                attachments={
                  attachments
                }
              />
            ) : attachments.length ? (
              <AttachmentList
                attachments={attachments}
              />
            ) : null}

            <MessageReceipt
              message={message}
              isMine={isMine}
            />
          </div>

          <div className="team-message-hover-actions">
            {message.body ? (
              <button
                type="button"
                title="Copy message"
                onClick={() => {
                  void onCopy?.();
                }}
              >
                Copy
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function SharedLeadMessage({
  message,
}) {
  const lead =
    message.metadata?.lead ||
    {};

  const leadId =
    message.metadata?.leadId ||
    lead.id ||
    "";

  const assignmentId =
    message.metadata
      ?.assignmentId ||
    "";

  return (
    <div className="team-shared-lead">
      <span>Shared lead</span>

      <strong>
        {lead.business ||
          lead.name ||
          message.body}
      </strong>

      <small>
        {lead.phone ||
          lead.email ||
          lead.website ||
          "No contact details"}
      </small>

      <a
        href={`/app/my-leads?assignmentId=${encodeURIComponent(
          assignmentId
        )}&leadId=${encodeURIComponent(
          leadId
        )}`}
      >
        Open lead
      </a>
    </div>
  );
}

function VoiceMessagePlayer({
  message,
  attachments,
}) {
  const audioAttachment =
    attachments.find(
      (attachment) =>
        String(
          attachment.mimeType ||
            attachment.type ||
            ""
        ).startsWith("audio/") ||
        attachment.kind ===
          "voice"
    );

  if (!audioAttachment?.url) {
    return (
      <div className="team-voice-message unavailable">
        Voice message unavailable
      </div>
    );
  }

  const durationSeconds =
    Number(
      message.metadata
        ?.durationSeconds ||
        audioAttachment
          .durationSeconds ||
        0
    );

  return (
    <div className="team-voice-message">
      <span>🎙</span>

      <audio
        controls
        preload="metadata"
        src={
          audioAttachment.url
        }
      />

      {durationSeconds > 0 ? (
        <small>
          {formatVoiceDuration(
            durationSeconds
          )}
        </small>
      ) : null}
    </div>
  );
}

function AttachmentList({
  attachments,
}) {
  return (
    <div className="team-attachment-list">
      {attachments.map(
        (attachment, index) =>
          attachment.mimeType?.startsWith(
            "image/"
          ) ||
          attachment.type?.startsWith(
            "image/"
          ) ? (
            <a
              key={
                attachment.id ||
                index
              }
              href={
                attachment.url
              }
              target="_blank"
              rel="noreferrer"
              className="team-image-attachment"
            >
              <img
                src={
                  attachment.url
                }
                alt={
                  attachment.name ||
                  "Shared image"
                }
              />
            </a>
          ) : (
            <a
              key={
                attachment.id ||
                index
              }
              href={
                attachment.url
              }
              target="_blank"
              rel="noreferrer"
              className="team-file-attachment"
            >
              <span>FILE</span>

              <div>
                <strong>
                  {attachment.name ||
                    "Attachment"}
                </strong>

                <small>
                  {formatFileSize(
                    attachment.size
                  )}
                </small>
              </div>
            </a>
          )
      )}
    </div>
  );
}

function MessageReceipt({
  message,
  isMine,
}) {
  if (!isMine) {
    return null;
  }

  const readCount =
    Number(
      message.readCount ||
        message.readBy?.length ||
        0
    );

  return (
    <small className="team-message-receipt">
      {readCount > 0
        ? `Read by ${readCount}`
        : "Sent"}
    </small>
  );
}

function TaskCard({
  task,
  currentUserId,
  canManage,
  onUpdate,
}) {
  const status =
    normalizeStatus(
      task.status ||
        "assigned"
    );

  const isAssignee =
    task.assigneeId ===
      currentUserId ||
    task.assignedToUserId ===
      currentUserId;

  return (
    <article
      className={`work-task ${
        task.priority ||
        "normal"
      }`}
    >
      <div className="task-priority">
        {task.priority ||
          "normal"}
      </div>

      <div className="task-main">
        <h4>{task.title}</h4>

        <p>
          {task.description ||
            "No additional instructions provided."}
        </p>

        {task.lead?.business ||
        task.lead?.name ? (
          <div className="task-lead">
            <b>
              {task.lead
                .business ||
                task.lead.name}
            </b>

            <span>
              {task.lead.phone ||
                task.lead.email ||
                task.lead.website}
            </span>
          </div>
        ) : null}

        <small>
          Assigned{" "}
          {formatDateTime(
            task.createdAt
          )}
          {task.dueAt
            ? ` · Due ${formatDateTime(
                task.dueAt
              )}`
            : ""}
        </small>
      </div>

      <div className="task-actions">
        <span
          className={`status ${status}`}
        >
          {formatRole(status)}
        </span>

        {(isAssignee ||
          canManage) &&
        status === "assigned" ? (
          <button
            type="button"
            onClick={() =>
              onUpdate(
                task,
                "in_progress"
              )
            }
          >
            Start work
          </button>
        ) : null}

        {(isAssignee ||
          canManage) &&
        [
          "in_progress",
          "blocked",
        ].includes(status) ? (
          <button
            type="button"
            onClick={() =>
              onUpdate(
                task,
                "completed"
              )
            }
          >
            Mark complete
          </button>
        ) : null}

        {canManage &&
        status !==
          "cancelled" &&
        status !==
          "completed" ? (
          <select
            value={status}
            onChange={(event) =>
              onUpdate(
                task,
                event.target.value
              )
            }
          >
            {TASK_STATUSES.map(
              (item) => (
                <option
                  key={item}
                  value={item}
                >
                  {formatRole(
                    item
                  )}
                </option>
              )
            )}
          </select>
        ) : null}
      </div>
    </article>
  );
}

function GroupDialog({
  members,
  form,
  busy,
  onChange,
  onClose,
  onSubmit,
}) {
  function toggleMember(
    memberId
  ) {
    onChange((current) => ({
      ...current,
      memberIds:
        current.memberIds.includes(
          memberId
        )
          ? current.memberIds.filter(
              (id) =>
                id !== memberId
            )
          : [
              ...current.memberIds,
              memberId,
            ],
    }));
  }

  return (
    <div className="team-dialog-backdrop">
      <section className="team-dialog">
        <header>
          <div>
            <span>
              Team communication
            </span>

            <h3>
              Create group
            </h3>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        <label>
          Group name

          <input
            value={form.name}
            onChange={(event) =>
              onChange(
                (current) => ({
                  ...current,
                  name:
                    event.target
                      .value,
                })
              )
            }
            placeholder="e.g. California outreach team"
          />
        </label>

        <label>
          Description

          <textarea
            value={
              form.description
            }
            onChange={(event) =>
              onChange(
                (current) => ({
                  ...current,
                  description:
                    event.target
                      .value,
                })
              )
            }
            placeholder="Describe the purpose of this group."
          />
        </label>

        <div className="team-group-member-list">
          {members.map(
            (member) => (
              <label
                key={member.id}
                className="team-group-member"
              >
                <input
                  type="checkbox"
                  checked={form.memberIds.includes(
                    member.id
                  )}
                  onChange={() =>
                    toggleMember(
                      member.id
                    )
                  }
                />

                <MemberAvatar
                  member={member}
                />

                <span>
                  <b>
                    {member.name ||
                      member.email}
                  </b>

                  <small>
                    {formatRole(
                      member.workspaceRole ||
                        member.role ||
                        "member"
                    )}
                  </small>
                </span>
              </label>
            )
          )}
        </div>

        <footer>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>

          <button
            type="button"
            className="primary"
            onClick={() =>
              void onSubmit()
            }
            disabled={
              busy ||
              !form.name.trim() ||
              !form.memberIds.length
            }
          >
            {busy
              ? "Creating…"
              : "Create group"}
          </button>
        </footer>
      </section>
    </div>
  );
}

function IncomingCallDialog({
  call,
  onAccept,
  onReject,
}) {
  return (
    <div className="team-dialog-backdrop">
      <section className="team-incoming-call">
        <MemberAvatar
          member={{
            name:
              call?.callerName ||
              call?.fromUserName ||
              "Team member",
            avatarUrl:
              call?.callerAvatarUrl,
          }}
          large
        />

        <span>
          Incoming{" "}
          {call?.type === "video"
            ? "video"
            : "audio"}{" "}
          call
        </span>

        <h3>
          {call?.callerName ||
            call?.fromUserName ||
            "Team member"}
        </h3>

        <div>
          <button
            type="button"
            className="reject"
            onClick={() =>
              void onReject()
            }
          >
            Decline
          </button>

          <button
            type="button"
            className="accept"
            onClick={() =>
              void onAccept()
            }
          >
            Accept
          </button>
        </div>
      </section>
    </div>
  );
}

function InternalCallOverlay({
  call,
  callState,
  muted,
  cameraEnabled,
  localVideoRef,
  remoteVideoRef,
  onToggleMute,
  onToggleCamera,
  onEnd,
}) {
  return (
    <section className="team-call-overlay">
      <div className="team-call-stage">
        <video
          ref={remoteVideoRef}
          autoPlay
          playsInline
          className="team-call-remote-video"
        />

        <video
          ref={localVideoRef}
          autoPlay
          playsInline
          muted
          className="team-call-local-video"
        />

        <div className="team-call-fallback">
          <MemberAvatar
            member={{
              name:
                call.targetName ||
                call.callerName ||
                call.otherMember
                  ?.name ||
                "Team member",
              avatarUrl:
                call.targetAvatarUrl ||
                call.callerAvatarUrl ||
                call.otherMember
                  ?.avatarUrl,
            }}
            large
          />

          <h3>
            {call.targetName ||
              call.callerName ||
              call.otherMember
                ?.name ||
              "Team member"}
          </h3>

          <span>
            {formatRole(
              callState
            )}
          </span>
        </div>
      </div>

      <footer>
        <button
          type="button"
          className={
            muted
              ? "active"
              : ""
          }
          onClick={
            onToggleMute
          }
        >
          {muted
            ? "Unmute"
            : "Mute"}
        </button>

        <button
          type="button"
          className={
            cameraEnabled
              ? "active"
              : ""
          }
          onClick={
            onToggleCamera
          }
        >
          {cameraEnabled
            ? "Camera on"
            : "Camera off"}
        </button>

        <button
          type="button"
          className="end"
          onClick={() =>
            void onEnd()
          }
        >
          End call
        </button>
      </footer>
    </section>
  );
}

function LeadShareMenu({
  assignments,
  disabled,
  onShare,
}) {
  const [open, setOpen] =
    useState(false);

  if (!assignments.length) {
    return null;
  }

  return (
    <div className="team-lead-share-menu">
      <button
        type="button"
        disabled={disabled}
        title="Share lead"
        onClick={() =>
          setOpen(
            (current) =>
              !current
          )
        }
      >
        LEAD
      </button>

      {open ? (
        <div>
          {assignments
            .slice(0, 50)
            .map(
              (assignment) => (
                <button
                  type="button"
                  key={
                    assignment.id
                  }
                  onClick={() => {
                    setOpen(false);
                    void onShare(
                      assignment
                    );
                  }}
                >
                  {assignment.lead
                    ?.business ||
                    assignment.lead
                      ?.name ||
                    assignment.leadId}
                </button>
              )
            )}
        </div>
      ) : null}
    </div>
  );
}

function ChannelAvatar({
  channel = {},
  large = false,
}) {
  const directMember =
    channel.otherMember ||
    channel.member ||
    null;

  if (
    channel.type === "direct" &&
    directMember
  ) {
    return (
      <MemberAvatar
        member={directMember}
        large={large}
        className="team-channel-avatar"
      />
    );
  }

  return (
    <i
      className={`team-channel-avatar ${
        large ? "large" : ""
      }`}
    >
      #
    </i>
  );
}

function MemberAvatar({
  member = {},
  large = false,
  className = "",
}) {
  const [failedUrl, setFailedUrl] =
    useState("");

  const displayName =
    member.name ||
    member.fullName ||
    member.email ||
    "Team member";

  const avatarUrl =
    getProfileAvatar(member);

  const imageFailed =
    avatarUrl &&
    failedUrl === avatarUrl;

  return (
    <i
      className={[
        "team-member-avatar",
        large ? "large" : "",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      title={displayName}
    >
      {avatarUrl &&
      !imageFailed ? (
        <img
          key={avatarUrl}
          src={avatarUrl}
          alt={displayName}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() =>
            setFailedUrl(avatarUrl)
          }
        />
      ) : (
        initials(displayName)
      )}
    </i>
  );
}

function PresenceDot({
  status,
}) {
  const normalizedStatus =
    normalizeStatus(
      getPresenceStatus(status)
    ) || "offline";

  return (
    <i
      className={`team-presence-dot ${normalizedStatus}`}
      title={formatPresenceText(
        status
      )}
    />
  );
}

function MessageLoadingState() {
  return (
    <div className="team-message-loading">
      <span />
      <span />
      <span />
    </div>
  );
}

function normalizeRole(value) {
  const role =
    normalizeStatus(value);

  if (role.includes("owner")) {
    return "owner";
  }

  if (role.includes("admin")) {
    return "admin";
  }

  if (role.includes("manager")) {
    return "manager";
  }

  if (
    role === "caller" ||
    role.includes(
      "cold_caller"
    ) ||
    role.includes(
      "sales_rep"
    ) ||
    role.includes(
      "telemarketer"
    )
  ) {
    return "caller";
  }

  return role || "caller";
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/-/g, "_");
}

function formatRole(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

function initials(value) {
  return String(value || "RF")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}


async function requestCallMedia({
  video = false,
} = {}) {
  if (
    !window.isSecureContext ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !==
      "function"
  ) {
    const error = new Error(
      "Microphone and camera access require HTTPS when the application is opened from another computer on the local network."
    );

    error.code =
      "INSECURE_MEDIA_CONTEXT";

    throw error;
  }

  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: Boolean(video),
    });
  } catch (error) {
    if (
      error?.name === "NotAllowedError" ||
      error?.name === "SecurityError"
    ) {
      throw new Error(
        "Microphone or camera permission was denied. Allow access in the browser site settings and try again."
      );
    }

    if (
      error?.name === "NotFoundError" ||
      error?.name === "DevicesNotFoundError"
    ) {
      throw new Error(
        video
          ? "No usable microphone or camera was found."
          : "No usable microphone was found."
      );
    }

    if (
      error?.name === "NotReadableError" ||
      error?.name === "TrackStartError"
    ) {
      throw new Error(
        "The microphone or camera is already being used by another application."
      );
    }

    throw error;
  }
}

function hydrateChannelProfiles(
  channel,
  memberDirectory,
  currentUserId
) {
  const nextChannel = {
    ...channel,
  };

  const memberIds = [
    ...(Array.isArray(channel.memberIds)
      ? channel.memberIds
      : []),
    ...(Array.isArray(channel.memberUserIds)
      ? channel.memberUserIds
      : []),
    ...(Array.isArray(channel.members)
      ? channel.members
          .map((member) =>
            typeof member === "string"
              ? member
              : member?.id ||
                member?.userId
          )
          .filter(Boolean)
      : []),
  ];

  const uniqueMemberIds = [
    ...new Set(memberIds),
  ];

  const resolvedMembers =
    uniqueMemberIds
      .map((memberId) => {
        const storedMember =
          Array.isArray(channel.members)
            ? channel.members.find(
                (member) =>
                  (member?.id ||
                    member?.userId ||
                    member) === memberId
              )
            : null;

        return {
          ...(typeof storedMember === "object"
            ? storedMember
            : {}),
          ...(memberDirectory.get(memberId) || {}),
          id: memberId,
          userId: memberId,
        };
      })
      .filter(
        (member) =>
          member.id &&
          (member.name ||
            member.email ||
            memberDirectory.has(member.id))
      );

  if (resolvedMembers.length) {
    nextChannel.members =
      resolvedMembers;
  }

  if (channel.type === "direct") {
    const candidateId =
      channel.otherMember?.id ||
      channel.otherMember?.userId ||
      channel.otherUserId ||
      channel.recipientUserId ||
      uniqueMemberIds.find(
        (memberId) =>
          memberId !== currentUserId
      );

    const storedOther =
      channel.otherMember ||
      resolvedMembers.find(
        (member) =>
          member.id === candidateId
      ) ||
      null;

    if (candidateId) {
      nextChannel.otherMember = {
        ...(storedOther || {}),
        ...(memberDirectory.get(candidateId) || {}),
        id: candidateId,
        userId: candidateId,
      };

      nextChannel.name =
        nextChannel.otherMember.name ||
        nextChannel.otherMember.fullName ||
        nextChannel.otherMember.email ||
        channel.name;
    }
  }

  if (channel.lastMessage) {
    nextChannel.lastMessage =
      hydrateMessageProfile(
        channel.lastMessage,
        memberDirectory
      );
  }

  return nextChannel;
}

function hydrateMessageProfile(
  message,
  memberDirectory
) {
  const authorId =
    getMessageAuthorId(message);

  if (!authorId) {
    return message;
  }

  const currentProfile =
    memberDirectory.get(authorId);

  if (!currentProfile) {
    return message;
  }

  const avatarUrl =
    getProfileAvatar(currentProfile);

  return {
    ...message,

    userId:
      message.userId ||
      authorId,

    authorId:
      message.authorId ||
      authorId,

    senderId:
      message.senderId ||
      authorId,

    authorName:
      currentProfile.name ||
      currentProfile.fullName ||
      message.authorName ||
      message.senderName,

    senderName:
      currentProfile.name ||
      currentProfile.fullName ||
      message.senderName ||
      message.authorName,

    authorRole:
      currentProfile.workspaceRole ||
      currentProfile.role ||
      message.authorRole,

    authorAvatarUrl:
      avatarUrl ||
      message.authorAvatarUrl ||
      message.senderAvatar ||
      "",

    senderAvatar:
      avatarUrl ||
      message.senderAvatar ||
      message.authorAvatarUrl ||
      "",

    user: {
      ...(message.user || {}),
      ...currentProfile,
      id: authorId,
      avatarUrl:
        avatarUrl ||
        message.user?.avatarUrl ||
        "",
    },
  };
}

function getProfileAvatar(
  profile
) {
  if (
    !profile ||
    typeof profile !== "object"
  ) {
    return "";
  }

  return (
    profile.avatarUrl ||
    profile.photoUrl ||
    profile.profileImage ||
    profile.profileImageUrl ||
    profile.picture ||
    ""
  );
}

function formatVoiceDuration(
  value
) {
  const totalSeconds =
    Math.max(
      0,
      Number(value || 0)
    );

  const minutes =
    Math.floor(
      totalSeconds / 60
    );

  const seconds =
    Math.floor(
      totalSeconds % 60
    );

  return `${minutes}:${String(
    seconds
  ).padStart(2, "0")}`;
}

function getMessageAuthorId(message) {
  return (
    message?.userId ||
    message?.authorId ||
    message?.senderId ||
    message?.user?.id ||
    ""
  );
}

function formatMessageTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      hour: "numeric",
      minute: "2-digit",
    }
  ).format(date);
}

function getPresenceStatus(value) {
  if (
    value &&
    typeof value === "object"
  ) {
    return (
      value.status ||
      value.availabilityStatus ||
      value.presence ||
      "offline"
    );
  }

  return value || "offline";
}

function getPresenceTimestamp(
  value,
  {
    preferLogin = false,
  } = {}
) {
  if (
    !value ||
    typeof value !== "object"
  ) {
    return "";
  }

  const loginTime =
    value.loginAt ||
    value.loggedInAt ||
    value.lastLoginAt ||
    value.sessionStartedAt ||
    value.connectedAt ||
    value.onlineAt;

  const activityTime =
    value.lastSeenAt ||
    value.lastActiveAt ||
    value.disconnectedAt ||
    value.updatedAt ||
    value.createdAt;

  return preferLogin
    ? loginTime ||
        activityTime ||
        ""
    : activityTime ||
        loginTime ||
        "";
}

function formatPresenceClock(
  value
) {
  if (!value) {
    return "";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "";
  }

  const today =
    new Date();

  const sameDay =
    date.getFullYear() ===
      today.getFullYear() &&
    date.getMonth() ===
      today.getMonth() &&
    date.getDate() ===
      today.getDate();

  return new Intl.DateTimeFormat(
    undefined,
    sameDay
      ? {
          hour: "numeric",
          minute: "2-digit",
        }
      : {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        }
  ).format(date);
}

function formatPresenceText(value) {
  const status =
    normalizeStatus(
      getPresenceStatus(value)
    );

  if (
    status === "online" ||
    status === "available"
  ) {
    const loginTime =
      formatPresenceClock(
        getPresenceTimestamp(
          value,
          {
            preferLogin: true,
          }
        )
      );

    return loginTime
      ? `Active now · signed in ${loginTime}`
      : "Active now";
  }

  if (status === "busy") {
    return "Busy";
  }

  if (status === "away") {
    const lastActive =
      formatPresenceClock(
        getPresenceTimestamp(
          value
        )
      );

    return lastActive
      ? `Away · last active ${lastActive}`
      : "Away";
  }

  const lastSeen =
    formatPresenceClock(
      getPresenceTimestamp(
        value
      )
    );

  return lastSeen
    ? `Offline · last seen ${lastSeen}`
    : "Offline";
}

function formatDateTime(value) {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "";
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

function formatFileSize(value) {
  const bytes =
    Number(value || 0);

  if (!bytes) {
    return "";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (
    bytes <
    1024 * 1024
  ) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`;
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`;
}

function upsertById(
  records,
  record
) {
  if (!record?.id) {
    return records;
  }

  const exists =
    records.some(
      (item) =>
        item.id === record.id
    );

  if (!exists) {
    return [
      ...records,
      record,
    ];
  }

  return records.map((item) =>
    item.id === record.id
      ? {
          ...item,
          ...record,
        }
      : item
  );
}