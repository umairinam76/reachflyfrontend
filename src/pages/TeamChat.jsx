import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  acceptInternalCall,
  createChatChannel,
  createSharedResource,
  declineInternalCall,
  deleteChatMessage,
  editChatMessage,
  emitSocketEvent,
  endInternalCall,
  getMyProfile,
  getWorkspaceSocket,
  listChatChannels,
  listDirectConversations,
  listSharedResources,
  listTeamMembers,
  loadChannelMessages,
  loadDirectMessages,
  markConversationRead,
  onWorkspaceSocket,
  searchChatMessages,
  sendChatMessage,
  sendWebRtcSignal,
  startInternalCall,
} from "../lib/workspace-platform-client.js";
import "../styles.css"

const INITIAL_MESSAGE_LIMIT = 50;

const RTC_CONFIGURATION = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:stun1.l.google.com:19302",
      ],
    },
  ],
};

export default function TeamChat() {
  const [profile, setProfile] =
    useState(null);

  const [members, setMembers] =
    useState([]);

  const [channels, setChannels] =
    useState([]);

  const [conversations, setConversations] =
    useState([]);

  const [selectedConversation, setSelectedConversation] =
    useState(null);

  const [messages, setMessages] =
    useState([]);

  const [resources, setResources] =
    useState([]);

  const [onlineUsers, setOnlineUsers] =
    useState([]);

  const [typingUsers, setTypingUsers] =
    useState([]);

  const [composerValue, setComposerValue] =
    useState("");

  const [replyTo, setReplyTo] =
    useState(null);

  const [editingMessage, setEditingMessage] =
    useState(null);

  const [searchValue, setSearchValue] =
    useState("");

  const [searchResults, setSearchResults] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [conversationLoading, setConversationLoading] =
    useState(false);

  const [sending, setSending] =
    useState(false);

  const [error, setError] =
    useState("");

  const [showCreateGroup, setShowCreateGroup] =
    useState(false);

  const [showResources, setShowResources] =
    useState(false);

  const [incomingCall, setIncomingCall] =
    useState(null);

  const [activeCall, setActiveCall] =
    useState(null);

  const [callStatus, setCallStatus] =
    useState("");

  const messagesEndRef = useRef(null);
  const typingTimerRef = useRef(null);

  const localStreamRef = useRef(null);
  const peerConnectionsRef = useRef(
    new Map()
  );

  const remoteAudioRefs = useRef(
    new Map()
  );

  const currentProfileId =
    profile?.id || "";

  const selectedKey =
    selectedConversation?.key || "";

  const canCreateGroups = [
    "owner",
    "admin",
    "manager",
  ].includes(
    String(profile?.role || "")
      .toLowerCase()
  );

  const selectedTitle = useMemo(() => {
    if (!selectedConversation) {
      return "Team communication";
    }

    if (
      selectedConversation.type ===
      "channel"
    ) {
      return selectedConversation.channel
        ?.name || "Channel";
    }

    return (
      selectedConversation.user?.name ||
      "Direct message"
    );
  }, [selectedConversation]);

  const selectedSubtitle = useMemo(() => {
    if (!selectedConversation) {
      return "Select a teammate or channel.";
    }

    if (
      selectedConversation.type ===
      "channel"
    ) {
      const count =
        selectedConversation.channel
          ?.memberCount ||
        selectedConversation.channel
          ?.memberUserIds?.length ||
        0;

      return `${count} members`;
    }

    const target =
      selectedConversation.user;

    return isUserOnline(
      target?.id,
      onlineUsers
    )
      ? "Online"
      : target?.jobTitle ||
          target?.email ||
          "Offline";
  }, [
    onlineUsers,
    selectedConversation,
  ]);

  const loadWorkspace = useCallback(
    async () => {
      setLoading(true);
      setError("");

      try {
        const [
          profileResult,
          memberResult,
          channelResult,
          conversationResult,
        ] = await Promise.all([
          getMyProfile(),
          listTeamMembers(),
          listChatChannels(),
          listDirectConversations(),
        ]);

        setProfile(profileResult);
        setMembers(memberResult);
        setChannels(channelResult);
        setConversations(
          conversationResult
        );

        const firstChannel =
          channelResult.find(
            (channel) =>
              channel.isDefault
          ) || channelResult[0];

        if (
          !selectedConversation &&
          firstChannel
        ) {
          setSelectedConversation({
            key: `channel:${firstChannel.id}`,
            type: "channel",
            channel: firstChannel,
          });
        }
      } catch (requestError) {
        setError(
          requestError?.message ||
            "Team communication could not be loaded."
        );
      } finally {
        setLoading(false);
      }
    },
    [selectedConversation]
  );

  const loadConversation =
    useCallback(
      async (conversation) => {
        if (!conversation) {
          setMessages([]);
          return;
        }

        setConversationLoading(true);
        setError("");

        try {
          let result;

          if (
            conversation.type ===
            "channel"
          ) {
            result =
              await loadChannelMessages({
                channelId:
                  conversation.channel.id,
                limit:
                  INITIAL_MESSAGE_LIMIT,
              });

            const resourceResult =
              await listSharedResources({
                channelId:
                  conversation.channel.id,
              });

            setResources(
              resourceResult
            );

            await markConversationRead({
              channelId:
                conversation.channel.id,
            });
          } else {
            result =
              await loadDirectMessages({
                userId:
                  conversation.user.id,
                limit:
                  INITIAL_MESSAGE_LIMIT,
              });

            setResources([]);

            await markConversationRead({
              userId:
                conversation.user.id,
            });
          }

          setMessages(
            result.messages || []
          );

          window.setTimeout(
            scrollMessagesToEnd,
            50
          );
        } catch (requestError) {
          setError(
            requestError?.message ||
              "Messages could not be loaded."
          );
        } finally {
          setConversationLoading(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!selectedConversation) {
      return;
    }

    loadConversation(
      selectedConversation
    );
  }, [
    loadConversation,
    selectedKey,
  ]);

  useEffect(() => {
    getWorkspaceSocket();

    const unsubscribers = [
      onWorkspaceSocket(
        "socket:ready",
        (event) => {
          setOnlineUsers(
            event?.onlineUsers || []
          );
        }
      ),

      onWorkspaceSocket(
        "presence:update",
        (event) => {
          setOnlineUsers(
            event?.users || []
          );
        }
      ),

      onWorkspaceSocket(
        "message:new",
        ({ message }) => {
          if (!message) {
            return;
          }

          setMessages(
            (currentMessages) => {
              if (
                !doesMessageBelongToConversation(
                  message,
                  selectedConversation,
                  currentProfileId
                )
              ) {
                return currentMessages;
              }

              if (
                currentMessages.some(
                  (item) =>
                    item.id ===
                    message.id
                )
              ) {
                return currentMessages;
              }

              return [
                ...currentMessages,
                message,
              ];
            }
          );

          refreshSidebarData();

          window.setTimeout(
            scrollMessagesToEnd,
            50
          );
        }
      ),

      onWorkspaceSocket(
        "message:updated",
        ({ message }) => {
          updateMessageLocally(
            message
          );
        }
      ),

      onWorkspaceSocket(
        "message:deleted",
        ({ message }) => {
          updateMessageLocally(
            message
          );
        }
      ),

      onWorkspaceSocket(
        "typing:update",
        (event) => {
          if (
            !event?.user?.id ||
            event.user.id ===
              currentProfileId
          ) {
            return;
          }

          if (
            !doesTypingBelongToConversation(
              event,
              selectedConversation
            )
          ) {
            return;
          }

          setTypingUsers(
            (current) => {
              if (!event.typing) {
                return current.filter(
                  (item) =>
                    item.id !==
                    event.user.id
                );
              }

              if (
                current.some(
                  (item) =>
                    item.id ===
                    event.user.id
                )
              ) {
                return current;
              }

              return [
                ...current,
                event.user,
              ];
            }
          );
        }
      ),

      onWorkspaceSocket(
        "channel:created",
        refreshSidebarData
      ),

      onWorkspaceSocket(
        "channel:updated",
        refreshSidebarData
      ),

      onWorkspaceSocket(
        "channel:members-updated",
        refreshSidebarData
      ),

      onWorkspaceSocket(
        "resource:created",
        ({ resource }) => {
          if (
            resource?.channelId ===
            selectedConversation?.channel
              ?.id
          ) {
            setResources(
              (current) => [
                resource,
                ...current.filter(
                  (item) =>
                    item.id !==
                    resource.id
                ),
              ]
            );
          }
        }
      ),

      onWorkspaceSocket(
        "webrtc:call:incoming",
        ({ call }) => {
          setIncomingCall(call);
          setCallStatus(
            "Incoming call"
          );
        }
      ),

      onWorkspaceSocket(
        "webrtc:call:started",
        ({ call }) => {
          setActiveCall(call);
          setCallStatus(
            "Calling…"
          );
        }
      ),

      onWorkspaceSocket(
        "webrtc:call:accepted",
        async ({
          callId,
          user,
        }) => {
          if (
            activeCall?.id &&
            activeCall.id !== callId
          ) {
            return;
          }

          setCallStatus(
            `Connected with ${
              user?.name || "team member"
            }`
          );

          await createAndSendOffer({
            callId,
            targetUserId: user.id,
          });
        }
      ),

      onWorkspaceSocket(
        "webrtc:call:declined",
        () => {
          setCallStatus(
            "Call declined"
          );

          window.setTimeout(
            clearCallState,
            1_500
          );
        }
      ),

      onWorkspaceSocket(
        "webrtc:call:ended",
        () => {
          setCallStatus(
            "Call ended"
          );

          stopLocalMedia();
          closeAllPeerConnections();

          window.setTimeout(
            clearCallState,
            1_000
          );
        }
      ),

      onWorkspaceSocket(
        "webrtc:signal",
        handleIncomingSignal
      ),
    ];

    return () => {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }

      stopLocalMedia();
      closeAllPeerConnections();
    };
  }, [
    activeCall?.id,
    currentProfileId,
    selectedConversation,
  ]);

  useEffect(() => {
    setTypingUsers([]);
  }, [selectedKey]);

  async function refreshSidebarData() {
    try {
      const [
        channelResult,
        conversationResult,
      ] = await Promise.all([
        listChatChannels(),
        listDirectConversations(),
      ]);

      setChannels(channelResult);
      setConversations(
        conversationResult
      );
    } catch {
      // Real-time refresh failures should not interrupt chat.
    }
  }

  function selectChannel(channel) {
    setSelectedConversation({
      key: `channel:${channel.id}`,
      type: "channel",
      channel,
    });

    setSearchResults([]);
    setSearchValue("");
  }

  function selectDirectConversation(
    conversation
  ) {
    setSelectedConversation({
      key: `direct:${conversation.user.id}`,
      type: "direct",
      user: conversation.user,
    });

    setSearchResults([]);
    setSearchValue("");
  }

  function selectMember(member) {
    setSelectedConversation({
      key: `direct:${member.id}`,
      type: "direct",
      user: member,
    });

    setSearchResults([]);
    setSearchValue("");
  }

  async function submitMessage(event) {
    event.preventDefault();

    const body =
      composerValue.trim();

    if (
      !body ||
      !selectedConversation ||
      sending
    ) {
      return;
    }

    setSending(true);
    setError("");

    try {
      let message;

      if (editingMessage) {
        message =
          await editChatMessage(
            editingMessage.id,
            body
          );

        updateMessageLocally(
          message
        );

        setEditingMessage(null);
      } else {
        message =
          await sendChatMessage({
            body,

            replyToMessageId:
              replyTo?.id || "",

            ...(selectedConversation.type ===
            "channel"
              ? {
                  channelId:
                    selectedConversation
                      .channel.id,
                }
              : {
                  recipientUserId:
                    selectedConversation
                      .user.id,
                }),
          });

        setMessages(
          (current) => {
            if (
              current.some(
                (item) =>
                  item.id ===
                  message.id
              )
            ) {
              return current;
            }

            return [
              ...current,
              message,
            ];
          }
        );
      }

      setComposerValue("");
      setReplyTo(null);

      emitTyping(false);

      window.setTimeout(
        scrollMessagesToEnd,
        50
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The message could not be sent."
      );
    } finally {
      setSending(false);
    }
  }

  function updateMessageLocally(
    message
  ) {
    if (!message?.id) {
      return;
    }

    setMessages((current) =>
      current.map((item) =>
        item.id === message.id
          ? message
          : item
      )
    );
  }

  async function removeMessage(
    message
  ) {
    const confirmed =
      window.confirm(
        "Delete this message?"
      );

    if (!confirmed) {
      return;
    }

    try {
      const deleted =
        await deleteChatMessage(
          message.id
        );

      updateMessageLocally(
        deleted
      );
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The message could not be deleted."
      );
    }
  }

  function beginEditing(message) {
    setEditingMessage(message);
    setComposerValue(
      message.body || ""
    );

    setReplyTo(null);
  }

  function cancelComposerMode() {
    setEditingMessage(null);
    setReplyTo(null);
    setComposerValue("");
    emitTyping(false);
  }

  function handleComposerChange(
    event
  ) {
    setComposerValue(
      event.target.value
    );

    emitTyping(true);

    window.clearTimeout(
      typingTimerRef.current
    );

    typingTimerRef.current =
      window.setTimeout(() => {
        emitTyping(false);
      }, 1_500);
  }

  function emitTyping(typing) {
    if (!selectedConversation) {
      return;
    }

    const eventName = typing
      ? "typing:start"
      : "typing:stop";

    const payload =
      selectedConversation.type ===
      "channel"
        ? {
            channelId:
              selectedConversation
                .channel.id,
          }
        : {
            recipientUserId:
              selectedConversation
                .user.id,
          };

    emitSocketEvent(
      eventName,
      payload,
      {
        timeoutMs: 5_000,
      }
    ).catch(() => {
      // Typing indicators are non-critical.
    });
  }

  async function runSearch(event) {
    event?.preventDefault();

    const query =
      searchValue.trim();

    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    try {
      const results =
        await searchChatMessages(
          query,
          selectedConversation?.type ===
            "channel"
            ? {
                channelId:
                  selectedConversation
                    .channel.id,
              }
            : selectedConversation?.type ===
                "direct"
              ? {
                  userId:
                    selectedConversation
                      .user.id,
                }
              : {}
        );

      setSearchResults(results);
    } catch (requestError) {
      setError(
        requestError?.message ||
          "Message search failed."
      );
    }
  }

  async function beginCall(
    callType = "audio"
  ) {
    if (
      !selectedConversation ||
      selectedConversation.type !==
        "direct"
    ) {
      setError(
        "Select a teammate before starting a direct call."
      );

      return;
    }

    try {
      await ensureLocalMedia(
        callType
      );

      const result =
        await startInternalCall({
          participantUserIds: [
            selectedConversation.user
              .id,
          ],
          callType,
        });

      const call =
        result?.call ||
        result?.data?.call ||
        result;

      setActiveCall(call);
      setCallStatus("Calling…");
    } catch (requestError) {
      stopLocalMedia();

      setError(
        requestError?.message ||
          "The internal call could not be started."
      );
    }
  }

  async function answerIncomingCall() {
    if (!incomingCall) {
      return;
    }

    try {
      await ensureLocalMedia(
        incomingCall.callType ||
          "audio"
      );

      await acceptInternalCall(
        incomingCall.id
      );

      setActiveCall(
        incomingCall
      );

      setIncomingCall(null);
      setCallStatus("Connecting…");
    } catch (requestError) {
      stopLocalMedia();

      setError(
        requestError?.message ||
          "The call could not be answered."
      );
    }
  }

  async function rejectIncomingCall() {
    if (!incomingCall) {
      return;
    }

    try {
      await declineInternalCall(
        incomingCall.id
      );
    } finally {
      setIncomingCall(null);
      setCallStatus("");
    }
  }

  async function hangUp() {
    const callId =
      activeCall?.id ||
      incomingCall?.id;

    if (!callId) {
      clearCallState();
      return;
    }

    try {
      await endInternalCall(
        callId
      );
    } catch {
      // Local cleanup should still happen.
    }

    stopLocalMedia();
    closeAllPeerConnections();
    clearCallState();
  }

  async function ensureLocalMedia(
    callType
  ) {
    if (
      localStreamRef.current
    ) {
      return localStreamRef.current;
    }

    const stream =
      await navigator.mediaDevices.getUserMedia(
        {
          audio: true,
          video:
            callType === "video",
        }
      );

    localStreamRef.current =
      stream;

    return stream;
  }

  async function getOrCreatePeerConnection({
    callId,
    targetUserId,
  }) {
    if (
      peerConnectionsRef.current.has(
        targetUserId
      )
    ) {
      return peerConnectionsRef.current.get(
        targetUserId
      );
    }

    const connection =
      new RTCPeerConnection(
        RTC_CONFIGURATION
      );

    const stream =
      localStreamRef.current;

    if (stream) {
      for (const track of stream.getTracks()) {
        connection.addTrack(
          track,
          stream
        );
      }
    }

    connection.onicecandidate = (
      event
    ) => {
      if (!event.candidate) {
        return;
      }

      sendWebRtcSignal({
        callId,
        targetUserId,
        signalType:
          "ice-candidate",
        signal:
          event.candidate.toJSON(),
      });
    };

    connection.ontrack = (
      event
    ) => {
      const remoteStream =
        event.streams?.[0];

      if (!remoteStream) {
        return;
      }

      let audioElement =
        remoteAudioRefs.current.get(
          targetUserId
        );

      if (!audioElement) {
        audioElement =
          document.createElement(
            "audio"
          );

        audioElement.autoplay = true;
        audioElement.playsInline = true;

        document.body.appendChild(
          audioElement
        );

        remoteAudioRefs.current.set(
          targetUserId,
          audioElement
        );
      }

      audioElement.srcObject =
        remoteStream;

      audioElement
        .play()
        .catch(() => {});
    };

    connection.onconnectionstatechange =
      () => {
        if (
          [
            "failed",
            "closed",
            "disconnected",
          ].includes(
            connection.connectionState
          )
        ) {
          closePeerConnection(
            targetUserId
          );
        }
      };

    peerConnectionsRef.current.set(
      targetUserId,
      connection
    );

    return connection;
  }

  async function createAndSendOffer({
    callId,
    targetUserId,
  }) {
    const connection =
      await getOrCreatePeerConnection({
        callId,
        targetUserId,
      });

    const offer =
      await connection.createOffer();

    await connection.setLocalDescription(
      offer
    );

    sendWebRtcSignal({
      callId,
      targetUserId,
      signalType: "offer",
      signal: offer,
    });
  }

  async function handleIncomingSignal(
    event
  ) {
    const {
      callId,
      fromUserId,
      signalType,
      signal,
    } = event || {};

    if (
      !callId ||
      !fromUserId ||
      !signalType
    ) {
      return;
    }

    const connection =
      await getOrCreatePeerConnection({
        callId,
        targetUserId:
          fromUserId,
      });

    if (signalType === "offer") {
      await connection.setRemoteDescription(
        new RTCSessionDescription(
          signal
        )
      );

      const answer =
        await connection.createAnswer();

      await connection.setLocalDescription(
        answer
      );

      sendWebRtcSignal({
        callId,
        targetUserId:
          fromUserId,
        signalType: "answer",
        signal: answer,
      });

      return;
    }

    if (
      signalType === "answer"
    ) {
      await connection.setRemoteDescription(
        new RTCSessionDescription(
          signal
        )
      );

      return;
    }

    if (
      signalType ===
      "ice-candidate"
    ) {
      await connection.addIceCandidate(
        new RTCIceCandidate(signal)
      );
    }
  }

  function stopLocalMedia() {
    const stream =
      localStreamRef.current;

    if (!stream) {
      return;
    }

    for (const track of stream.getTracks()) {
      track.stop();
    }

    localStreamRef.current = null;
  }

  function closePeerConnection(
    userId
  ) {
    const connection =
      peerConnectionsRef.current.get(
        userId
      );

    if (connection) {
      connection.close();

      peerConnectionsRef.current.delete(
        userId
      );
    }

    const audio =
      remoteAudioRefs.current.get(
        userId
      );

    if (audio) {
      audio.pause();
      audio.srcObject = null;
      audio.remove();

      remoteAudioRefs.current.delete(
        userId
      );
    }
  }

  function closeAllPeerConnections() {
    for (const userId of [
      ...peerConnectionsRef.current.keys(),
    ]) {
      closePeerConnection(userId);
    }
  }

  function clearCallState() {
    setIncomingCall(null);
    setActiveCall(null);
    setCallStatus("");
  }

  function scrollMessagesToEnd() {
    messagesEndRef.current?.scrollIntoView(
      {
        behavior: "smooth",
        block: "end",
      }
    );
  }

  if (loading) {
    return <TeamChatSkeleton />;
  }

  return (
    <main className="rf-team-chat-page rf-team-chat-v7">
      <TeamChatV7Styles />
      <section className="rf-team-chat-shell">
        <ChatSidebar
          profile={profile}
          channels={channels}
          conversations={
            conversations
          }
          members={members}
          onlineUsers={onlineUsers}
          selectedConversation={
            selectedConversation
          }
          canCreateGroups={
            canCreateGroups
          }
          onSelectChannel={
            selectChannel
          }
          onSelectConversation={
            selectDirectConversation
          }
          onSelectMember={
            selectMember
          }
          onCreateGroup={() =>
            setShowCreateGroup(true)
          }
        />

        <section className="rf-chat-main">
          <ChatHeader
            title={selectedTitle}
            subtitle={
              selectedSubtitle
            }
            selectedConversation={
              selectedConversation
            }
            onAudioCall={() =>
              beginCall("audio")
            }
            onVideoCall={() =>
              beginCall("video")
            }
            onToggleResources={() =>
              setShowResources(
                (current) =>
                  !current
              )
            }
            searchValue={
              searchValue
            }
            onSearchValueChange={
              setSearchValue
            }
            onSearch={runSearch}
          />

          {error ? (
            <div className="rf-chat-alert">
              <span>{safeTeamChatMessage(error)}</span>

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

          <div className="rf-chat-content">
            <section className="rf-message-area">
              {searchResults.length ? (
                <SearchResults
                  results={
                    searchResults
                  }
                  onClose={() =>
                    setSearchResults(
                      []
                    )
                  }
                />
              ) : (
                <MessageList
                  messages={
                    messages
                  }
                  loading={
                    conversationLoading
                  }
                  currentUserId={
                    currentProfileId
                  }
                  members={
                    members
                  }
                  onReply={
                    setReplyTo
                  }
                  onEdit={
                    beginEditing
                  }
                  onDelete={
                    removeMessage
                  }
                  endRef={
                    messagesEndRef
                  }
                />
              )}

              <TypingIndicator
                users={
                  typingUsers
                }
              />

              <MessageComposer
                value={
                  composerValue
                }
                sending={sending}
                disabled={
                  !selectedConversation
                }
                replyTo={replyTo}
                editingMessage={
                  editingMessage
                }
                onChange={
                  handleComposerChange
                }
                onSubmit={
                  submitMessage
                }
                onCancelMode={
                  cancelComposerMode
                }
              />
            </section>

            {showResources &&
            selectedConversation?.type ===
              "channel" ? (
              <ResourcePanel
                resources={
                  resources
                }
                channelId={
                  selectedConversation
                    .channel.id
                }
                onResourceCreated={(
                  resource
                ) =>
                  setResources(
                    (current) => [
                      resource,
                      ...current,
                    ]
                  )
                }
                onClose={() =>
                  setShowResources(
                    false
                  )
                }
              />
            ) : null}
          </div>
        </section>
      </section>

      {showCreateGroup ? (
        <CreateGroupDialog
          members={members}
          onClose={() =>
            setShowCreateGroup(
              false
            )
          }
          onCreated={(
            channel
          ) => {
            setChannels(
              (current) => [
                channel,
                ...current,
              ]
            );

            setShowCreateGroup(
              false
            );

            selectChannel(channel);
          }}
        />
      ) : null}

      {incomingCall ? (
        <IncomingCallDialog
          call={incomingCall}
          members={members}
          onAccept={
            answerIncomingCall
          }
          onDecline={
            rejectIncomingCall
          }
        />
      ) : null}

      {activeCall ? (
        <ActiveCallBar
          call={activeCall}
          status={callStatus}
          members={members}
          onEnd={hangUp}
        />
      ) : null}
    </main>
  );
}

function ChatSidebar({
  profile,
  channels,
  conversations,
  members,
  onlineUsers,
  selectedConversation,
  canCreateGroups,
  onSelectChannel,
  onSelectConversation,
  onSelectMember,
  onCreateGroup,
}) {
  const [
    memberSearch,
    setMemberSearch,
  ] = useState("");

  const filteredMembers =
    members.filter((member) => {
      if (
        member.id === profile?.id
      ) {
        return false;
      }

      const query =
        memberSearch
          .trim()
          .toLowerCase();

      if (!query) {
        return true;
      }

      return [
        member.name,
        member.email,
        member.jobTitle,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });

  return (
    <aside className="rf-chat-sidebar">
      <header className="rf-chat-sidebar__header">
        <div>
          <p>Internal workspace</p>
          <h1>Team communication</h1>
        </div>

        {canCreateGroups ? (
          <button
            type="button"
            className="rf-icon-button"
            onClick={
              onCreateGroup
            }
            title="Create group"
          >
            +
          </button>
        ) : null}
      </header>

      <div className="rf-sidebar-search">
        <input
          value={memberSearch}
          onChange={(event) =>
            setMemberSearch(
              event.target.value
            )
          }
          placeholder="Search teammates…"
        />
      </div>

      <div className="rf-sidebar-scroll">
        <SidebarSection
          title="Channels"
        >
          {channels.map(
            (channel) => (
              <SidebarChannel
                key={channel.id}
                channel={channel}
                selected={
                  selectedConversation
                    ?.type ===
                    "channel" &&
                  selectedConversation
                    ?.channel?.id ===
                    channel.id
                }
                onClick={() =>
                  onSelectChannel(
                    channel
                  )
                }
              />
            )
          )}
        </SidebarSection>

        <SidebarSection
          title="Recent messages"
        >
          {conversations
            .filter(
              (conversation) =>
                conversation
                  .lastMessage
            )
            .slice(0, 12)
            .map(
              (conversation) => (
                <SidebarConversation
                  key={
                    conversation.user
                      .id
                  }
                  conversation={
                    conversation
                  }
                  online={isUserOnline(
                    conversation.user
                      .id,
                    onlineUsers
                  )}
                  selected={
                    selectedConversation
                      ?.type ===
                      "direct" &&
                    selectedConversation
                      ?.user?.id ===
                      conversation.user
                        .id
                  }
                  onClick={() =>
                    onSelectConversation(
                      conversation
                    )
                  }
                />
              )
            )}
        </SidebarSection>

        <SidebarSection
          title="Team directory"
        >
          {filteredMembers.map(
            (member) => (
              <SidebarMember
                key={member.id}
                member={member}
                online={isUserOnline(
                  member.id,
                  onlineUsers
                )}
                selected={
                  selectedConversation
                    ?.type ===
                    "direct" &&
                  selectedConversation
                    ?.user?.id ===
                    member.id
                }
                onClick={() =>
                  onSelectMember(
                    member
                  )
                }
              />
            )
          )}
        </SidebarSection>
      </div>

      <footer className="rf-chat-sidebar__profile">
        <UserAvatar
          user={profile}
        />

        <div>
          <strong>
            {profile?.name}
          </strong>

          <small>
            {formatLabel(
              profile?.role
            )}
          </small>
        </div>

        <span
          className="rf-presence-dot rf-presence-dot--online"
          title="Online"
        />
      </footer>
    </aside>
  );
}

function SidebarSection({
  title,
  children,
}) {
  return (
    <section className="rf-sidebar-section">
      <h2>{title}</h2>
      <div>{children}</div>
    </section>
  );
}

function SidebarChannel({
  channel,
  selected,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`rf-sidebar-channel ${
        selected
          ? "is-selected"
          : ""
      }`}
      onClick={onClick}
    >
      <span>#</span>

      <div>
        <strong>
          {channel.name}
        </strong>

        <small>
          {channel.lastMessage
            ?.body ||
            channel.description ||
            "No messages yet"}
        </small>
      </div>

      {channel.unreadCount ? (
        <b>
          {channel.unreadCount}
        </b>
      ) : null}
    </button>
  );
}

function SidebarConversation({
  conversation,
  online,
  selected,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`rf-sidebar-person ${
        selected
          ? "is-selected"
          : ""
      }`}
      onClick={onClick}
    >
      <UserAvatar
        user={conversation.user}
        online={online}
      />

      <div>
        <strong>
          {conversation.user.name}
        </strong>

        <small>
          {conversation.lastMessage
            ?.body ||
            "Start a conversation"}
        </small>
      </div>

      {conversation.unreadCount ? (
        <b>
          {conversation.unreadCount}
        </b>
      ) : null}
    </button>
  );
}

function SidebarMember({
  member,
  online,
  selected,
  onClick,
}) {
  return (
    <button
      type="button"
      className={`rf-sidebar-person ${
        selected
          ? "is-selected"
          : ""
      }`}
      onClick={onClick}
    >
      <UserAvatar
        user={member}
        online={online}
      />

      <div>
        <strong>
          {member.name}
        </strong>

        <small>
          {member.jobTitle ||
            formatLabel(
              member.role
            )}
        </small>
      </div>
    </button>
  );
}

function ChatHeader({
  title,
  subtitle,
  selectedConversation,
  onAudioCall,
  onVideoCall,
  onToggleResources,
  searchValue,
  onSearchValueChange,
  onSearch,
}) {
  const canCall =
    selectedConversation?.type ===
    "direct";

  return (
    <header className="rf-chat-header">
      <div>
        <h2>{title}</h2>
        <p>{subtitle}</p>
      </div>

      <form
        className="rf-chat-search"
        onSubmit={onSearch}
      >
        <input
          value={searchValue}
          onChange={(event) =>
            onSearchValueChange(
              event.target.value
            )
          }
          placeholder="Search messages…"
        />
      </form>

      <div className="rf-chat-header__actions">
        {selectedConversation?.type ===
        "channel" ? (
          <button
            type="button"
            className="rf-chat-action-button"
            onClick={
              onToggleResources
            }
            title="Shared resources"
          >
            Resources
          </button>
        ) : null}

        <button
          type="button"
          className="rf-chat-action-button"
          onClick={onAudioCall}
          disabled={!canCall}
          title="Audio call"
        >
          Audio call
        </button>

        <button
          type="button"
          className="rf-chat-action-button rf-chat-action-button--primary"
          onClick={onVideoCall}
          disabled={!canCall}
          title="Video call"
        >
          Video call
        </button>
      </div>
    </header>
  );
}

function MessageList({
  messages,
  loading,
  currentUserId,
  members,
  onReply,
  onEdit,
  onDelete,
  endRef,
}) {
  if (loading) {
    return (
      <div className="rf-message-loading">
        <span />
        <span />
        <span />
      </div>
    );
  }

  if (!messages.length) {
    return (
      <div className="rf-chat-empty">
        <div>RF</div>
        <h3>
          Start the conversation
        </h3>
        <p>
          Send a professional message
          to your teammate or group.
        </p>
      </div>
    );
  }

  return (
    <div className="rf-message-list">
      {messages.map(
        (message, index) => {
          const own =
            message.senderId ===
            currentUserId;

          const sender =
            members.find(
              (member) =>
                member.id ===
                message.senderId
            ) || {
              id:
                message.senderId,
              name:
                message.senderName,
              avatarUrl:
                message.senderAvatar,
            };

          const previous =
            messages[index - 1];

          const showHeader =
            !previous ||
            previous.senderId !==
              message.senderId ||
            !isSameMinute(
              previous.createdAt,
              message.createdAt
            );

          return (
            <MessageBubble
              key={message.id}
              message={message}
              sender={sender}
              own={own}
              showHeader={showHeader}
              onReply={() =>
                onReply(message)
              }
              onEdit={() =>
                onEdit(message)
              }
              onDelete={() =>
                onDelete(message)
              }
            />
          );
        }
      )}

      <div ref={endRef} />
    </div>
  );
}

function MessageBubble({
  message,
  sender,
  own,
  showHeader,
  onReply,
  onEdit,
  onDelete,
}) {
  const deleted =
    Boolean(message.deletedAt);

  return (
    <article
      className={`rf-message-row ${
        own
          ? "rf-message-row--own"
          : ""
      }`}
    >
      {!own && showHeader ? (
        <UserAvatar
          user={sender}
        />
      ) : (
        <div className="rf-message-avatar-spacer" />
      )}

      <div className="rf-message-block">
        {showHeader ? (
          <div className="rf-message-meta">
            {!own ? (
              <strong>
                {sender.name}
              </strong>
            ) : null}

            <time>
              {formatMessageTime(
                message.createdAt
              )}
            </time>
          </div>
        ) : null}

        <div
          className={`rf-message-bubble ${
            deleted
              ? "is-deleted"
              : ""
          }`}
        >
          {deleted ? (
            <em>
              This message was deleted.
            </em>
          ) : (
            <>
              <p>{message.body}</p>

              {message.attachments
                ?.length ? (
                <div className="rf-message-attachments">
                  {message.attachments.map(
                    (
                      attachment
                    ) => (
                      <a
                        key={
                          attachment.id
                        }
                        href={
                          attachment.url
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        {
                          attachment.name
                        }
                      </a>
                    )
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>

        {!deleted ? (
          <div className="rf-message-actions">
            <button
              type="button"
              onClick={onReply}
            >
              Reply
            </button>

            {own ? (
              <>
                <button
                  type="button"
                  onClick={
                    onEdit
                  }
                >
                  Edit
                </button>

                <button
                  type="button"
                  onClick={
                    onDelete
                  }
                >
                  Delete
                </button>
              </>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
}

function MessageComposer({
  value,
  sending,
  disabled,
  replyTo,
  editingMessage,
  onChange,
  onSubmit,
  onCancelMode,
}) {
  return (
    <form
      className="rf-message-composer"
      onSubmit={onSubmit}
    >
      {replyTo ||
      editingMessage ? (
        <div className="rf-composer-context">
          <div>
            <strong>
              {editingMessage
                ? "Editing message"
                : `Replying to ${
                    replyTo
                      ?.senderName ||
                    "message"
                  }`}
            </strong>

            <span>
              {editingMessage
                ?.body ||
                replyTo?.body}
            </span>
          </div>

          <button
            type="button"
            onClick={
              onCancelMode
            }
          >
            ×
          </button>
        </div>
      ) : null}

      <div className="rf-message-composer__body">
        <textarea
          value={value}
          onChange={onChange}
          disabled={disabled}
          rows={1}
          placeholder={
            disabled
              ? "Select a conversation"
              : "Write a message…"
          }
          onKeyDown={(event) => {
            if (
              event.key ===
                "Enter" &&
              !event.shiftKey
            ) {
              event.preventDefault();

              event.currentTarget
                .form?.requestSubmit();
            }
          }}
        />

        <button
          type="submit"
          disabled={
            disabled ||
            sending ||
            !value.trim()
          }
        >
          {sending
            ? "Sending…"
            : editingMessage
              ? "Save"
              : "Send"}
        </button>
      </div>
    </form>
  );
}

function TypingIndicator({
  users,
}) {
  if (!users.length) {
    return (
      <div className="rf-typing-space" />
    );
  }

  return (
    <div className="rf-typing-indicator">
      <span>
        {users
          .map(
            (user) =>
              user.name
          )
          .join(", ")}{" "}
        {users.length === 1
          ? "is"
          : "are"}{" "}
        typing
      </span>

      <i />
      <i />
      <i />
    </div>
  );
}

function ResourcePanel({
  resources,
  channelId,
  onResourceCreated,
  onClose,
}) {
  const [showForm, setShowForm] =
    useState(false);

  const [name, setName] =
    useState("");

  const [url, setUrl] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [saving, setSaving] =
    useState(false);

  async function submitResource(
    event
  ) {
    event.preventDefault();

    if (!name.trim() || !url.trim()) {
      return;
    }

    setSaving(true);

    try {
      const resource =
        await createSharedResource({
          channelId,
          name: name.trim(),
          url: url.trim(),
          description:
            description.trim(),
          type: "link",
        });

      onResourceCreated(
        resource
      );

      setName("");
      setUrl("");
      setDescription("");
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside className="rf-resource-panel">
      <header>
        <div>
          <h3>
            Shared resources
          </h3>
          <p>
            Documents, links and team
            material.
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
        >
          ×
        </button>
      </header>

      <button
        type="button"
        className="rf-resource-add"
        onClick={() =>
          setShowForm(
            (current) =>
              !current
          )
        }
      >
        Add resource
      </button>

      {showForm ? (
        <form
          className="rf-resource-form"
          onSubmit={
            submitResource
          }
        >
          <input
            value={name}
            onChange={(event) =>
              setName(
                event.target.value
              )
            }
            placeholder="Resource name"
          />

          <input
            value={url}
            onChange={(event) =>
              setUrl(
                event.target.value
              )
            }
            placeholder="https://..."
          />

          <textarea
            value={description}
            onChange={(event) =>
              setDescription(
                event.target.value
              )
            }
            placeholder="Short description"
          />

          <button
            type="submit"
            disabled={
              saving ||
              !name.trim() ||
              !url.trim()
            }
          >
            {saving
              ? "Saving…"
              : "Share resource"}
          </button>
        </form>
      ) : null}

      <div className="rf-resource-list">
        {!resources.length ? (
          <div className="rf-resource-empty">
            No resources have been
            shared in this channel.
          </div>
        ) : (
          resources.map(
            (resource) => (
              <a
                key={resource.id}
                href={resource.url}
                target="_blank"
                rel="noreferrer"
                className="rf-resource-card"
              >
                <div>
                  {getResourceInitial(
                    resource.type
                  )}
                </div>

                <span>
                  <strong>
                    {resource.name}
                  </strong>

                  <small>
                    {resource.description ||
                      resource.url}
                  </small>
                </span>
              </a>
            )
          )
        )}
      </div>
    </aside>
  );
}

function CreateGroupDialog({
  members,
  onClose,
  onCreated,
}) {
  const [name, setName] =
    useState("");

  const [description, setDescription] =
    useState("");

  const [
    selectedMemberIds,
    setSelectedMemberIds,
  ] = useState([]);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  function toggleMember(
    userId
  ) {
    setSelectedMemberIds(
      (current) =>
        current.includes(userId)
          ? current.filter(
              (id) =>
                id !== userId
            )
          : [...current, userId]
    );
  }

  async function submit(event) {
    event.preventDefault();

    if (!name.trim()) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const channel =
        await createChatChannel({
          name: name.trim(),
          description:
            description.trim(),
          type: "private",
          memberUserIds:
            selectedMemberIds,
        });

      onCreated(channel);
    } catch (requestError) {
      setError(
        requestError?.message ||
          "The group could not be created."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rf-modal-backdrop">
      <form
        className="rf-group-dialog"
        onSubmit={submit}
      >
        <header>
          <div>
            <p>
              Team communication
            </p>
            <h2>
              Create a private group
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </header>

        {error ? (
          <div className="rf-dialog-error">
            {error}
          </div>
        ) : null}

        <label>
          Group name
          <input
            value={name}
            onChange={(event) =>
              setName(
                event.target.value
              )
            }
            placeholder="Sales operations"
          />
        </label>

        <label>
          Description
          <textarea
            value={description}
            onChange={(event) =>
              setDescription(
                event.target.value
              )
            }
            placeholder="Purpose of this group"
          />
        </label>

        <fieldset>
          <legend>
            Add team members
          </legend>

          <div className="rf-group-member-list">
            {members.map(
              (member) => (
                <label
                  key={member.id}
                  className="rf-group-member"
                >
                  <input
                    type="checkbox"
                    checked={selectedMemberIds.includes(
                      member.id
                    )}
                    onChange={() =>
                      toggleMember(
                        member.id
                      )
                    }
                  />

                  <UserAvatar
                    user={member}
                  />

                  <span>
                    <strong>
                      {member.name}
                    </strong>

                    <small>
                      {member.jobTitle ||
                        formatLabel(
                          member.role
                        )}
                    </small>
                  </span>
                </label>
              )
            )}
          </div>
        </fieldset>

        <footer>
          <button
            type="button"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={
              saving ||
              !name.trim()
            }
          >
            {saving
              ? "Creating…"
              : "Create group"}
          </button>
        </footer>
      </form>
    </div>
  );
}

function IncomingCallDialog({
  call,
  members,
  onAccept,
  onDecline,
}) {
  const caller =
    members.find(
      (member) =>
        member.id ===
        call.initiatedBy
    ) || {
      name:
        call.initiatedByName ||
        "Team member",
    };

  return (
    <div className="rf-call-dialog">
      <div className="rf-call-dialog__pulse">
        <UserAvatar
          user={caller}
          size="large"
        />
      </div>

      <p>
        Incoming{" "}
        {call.callType === "video"
          ? "video"
          : "audio"}{" "}
        call
      </p>

      <h3>{caller.name}</h3>

      <div className="rf-call-dialog__actions">
        <button
          type="button"
          className="rf-call-decline"
          onClick={onDecline}
        >
          Decline
        </button>

        <button
          type="button"
          className="rf-call-accept"
          onClick={onAccept}
        >
          Accept
        </button>
      </div>
    </div>
  );
}

function ActiveCallBar({
  call,
  status,
  members,
  onEnd,
}) {
  const participants =
    (call.participantUserIds ||
      [])
      .map((userId) =>
        members.find(
          (member) =>
            member.id ===
            userId
        )
      )
      .filter(Boolean);

  return (
    <div className="rf-active-call-bar">
      <div className="rf-active-call-bar__avatars">
        {participants
          .slice(0, 3)
          .map((member) => (
            <UserAvatar
              key={member.id}
              user={member}
            />
          ))}
      </div>

      <div>
        <strong>
          {status || "Call active"}
        </strong>

        <small>
          {call.callType === "video"
            ? "Video call"
            : "Audio call"}
        </small>
      </div>

      <button
        type="button"
        onClick={onEnd}
      >
        End call
      </button>
    </div>
  );
}

function SearchResults({
  results,
  onClose,
}) {
  return (
    <section className="rf-search-results">
      <header>
        <div>
          <h3>
            Search results
          </h3>
          <p>
            {results.length} matching
            messages
          </p>
        </div>

        <button
          type="button"
          onClick={onClose}
        >
          Close
        </button>
      </header>

      <div>
        {results.map(
          (message) => (
            <article
              key={message.id}
            >
              <strong>
                {message.senderName}
              </strong>

              <p>{message.body}</p>

              <time>
                {formatMessageTime(
                  message.createdAt
                )}
              </time>
            </article>
          )
        )}
      </div>
    </section>
  );
}

function UserAvatar({
  user = {},
  online = false,
  size = "normal",
}) {
  const [imageFailed, setImageFailed] =
    useState(false);

  return (
    <span
      className={`rf-chat-avatar rf-chat-avatar--${size}`}
    >
      {user.avatarUrl &&
      !imageFailed ? (
        <img
          src={user.avatarUrl}
          alt={user.name || "User"}
          onError={() =>
            setImageFailed(true)
          }
        />
      ) : (
        <b>
          {getInitials(
            user.name ||
              user.email ||
              "RF"
          )}
        </b>
      )}

      {online ? (
        <i className="rf-chat-avatar__online" />
      ) : null}
    </span>
  );
}

function TeamChatSkeleton() {
  return (
    <main className="rf-team-chat-page rf-team-chat-v7">
      <TeamChatV7Styles />
      <section className="rf-team-chat-shell rf-team-chat-shell--loading">
        <aside />
        <section>
          <header />
          <div />
        </section>
      </section>
    </main>
  );
}

function doesMessageBelongToConversation(
  message,
  conversation,
  currentUserId
) {
  if (!conversation) {
    return false;
  }

  if (
    conversation.type === "channel"
  ) {
    return (
      message.channelId ===
      conversation.channel.id
    );
  }

  const otherUserId =
    conversation.user.id;

  return (
    !message.channelId &&
    (
      (
        message.senderId ===
          currentUserId &&
        message.recipientUserId ===
          otherUserId
      ) ||
      (
        message.senderId ===
          otherUserId &&
        message.recipientUserId ===
          currentUserId
      )
    )
  );
}

function doesTypingBelongToConversation(
  event,
  conversation
) {
  if (!conversation) {
    return false;
  }

  if (
    conversation.type === "channel"
  ) {
    return (
      event.channelId ===
      conversation.channel.id
    );
  }

  return (
    event.user?.id ===
    conversation.user.id
  );
}

function isUserOnline(
  userId,
  onlineUsers
) {
  return onlineUsers.some(
    (user) =>
      user.id === userId
  );
}

function isSameMinute(
  first,
  second
) {
  const firstDate =
    new Date(first);

  const secondDate =
    new Date(second);

  if (
    Number.isNaN(
      firstDate.getTime()
    ) ||
    Number.isNaN(
      secondDate.getTime()
    )
  ) {
    return false;
  }

  return (
    Math.floor(
      firstDate.getTime() /
        60_000
    ) ===
    Math.floor(
      secondDate.getTime() /
        60_000
    )
  );
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

function formatMessageTime(
  value
) {
  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "";
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      hour: "numeric",
      minute: "2-digit",
      month: "short",
      day: "numeric",
    }
  ).format(date);
}

function formatLabel(value) {
  return String(value || "")
    .replace(/_/g, " ")
    .split(" ")
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

function getResourceInitial(type) {
  const normalized =
    String(type || "link");

  return normalized
    .slice(0, 2)
    .toUpperCase();
}

function safeTeamChatMessage(value) {
  return String(value || "")
    .replace(/ElevenLabs/gi, "voice service")
    .replace(/Telnyx/gi, "calling service")
    .replace(/\bSIP\b/gi, "voice connection")
    .replace(/\bWebRTC\b/gi, "team call");
}

function TeamChatV7Styles() {
  return (
    <style>{`
      .rf-team-chat-v7{
        --rftc-card:#fff;
        --rftc-soft:#f6f7f8;
        --rftc-text:#191c1d;
        --rftc-text2:#4d4c59;
        --rftc-muted:#777784;
        --rftc-line:#e2e4e7;
        --rftc-primary:#4648d4;
        --rftc-primary-dark:#393bbb;
        --rftc-primary-soft:#e8e9ff;
        --rftc-green:#087a51;
        --rftc-green-soft:#e4f7ee;
        --rftc-red:#ba1a1a;
        --rftc-red-soft:#ffedeb;
        --rftc-dark:#2e3132;
        --rftc-ease:cubic-bezier(.2,.8,.2,1);
        width:100%;
        min-height:100%;
        padding:24px 30px 52px;
        color:var(--rftc-text);
        font-family:Inter,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;
        animation:rftcPageIn .24s var(--rftc-ease);
      }

      .rf-team-chat-v7 *,
      .rf-team-chat-v7 *::before,
      .rf-team-chat-v7 *::after{
        box-sizing:border-box;
      }

      @keyframes rftcPageIn{
        from{opacity:0;transform:translateY(5px)}
        to{opacity:1;transform:none}
      }

      @keyframes rftcPulse{
        0%,100%{opacity:.4}
        50%{opacity:1}
      }

      .rf-team-chat-v7 .rf-team-chat-shell{
        min-height:720px;
        display:grid;
        grid-template-columns:245px minmax(0,1fr);
        overflow:hidden;
        background:#fff;
        border:1px solid var(--rftc-line);
        border-radius:13px;
        box-shadow:0 1px 3px rgba(25,28,29,.025);
      }

      .rf-team-chat-v7 .rf-chat-sidebar{
        min-width:0;
        display:grid;
        grid-template-rows:auto auto minmax(0,1fr);
        background:#fafbfb;
        border-right:1px solid var(--rftc-line);
      }

      .rf-team-chat-v7 .rf-chat-sidebar__header{
        padding:12px 11px;
        background:
          radial-gradient(circle at 94% 4%,rgba(70,72,212,.06),transparent 32%),
          #fff;
        border-bottom:1px solid var(--rftc-line);
      }

      .rf-team-chat-v7 .rf-chat-sidebar__profile{
        min-width:0;
        display:grid;
        grid-template-columns:38px minmax(0,1fr);
        align-items:center;
        gap:8px;
      }

      .rf-team-chat-v7 .rf-sidebar-search{
        min-height:38px;
        display:flex;
        align-items:center;
        gap:6px;
        margin:7px;
        padding:0 8px;
        background:#fff;
        border:1px solid var(--rftc-line);
        border-radius:8px;
      }

      .rf-team-chat-v7 .rf-sidebar-search input{
        min-width:0;
        width:100%;
        min-height:36px;
        padding:0;
        color:var(--rftc-text);
        background:transparent;
        border:0;
        outline:0;
        font-size:6.5px;
      }

      .rf-team-chat-v7 .rf-sidebar-scroll{
        min-height:0;
        overflow-y:auto;
        padding:5px;
        scrollbar-width:thin;
        scrollbar-color:#d8dadd transparent;
      }

      .rf-team-chat-v7 .rf-sidebar-section{
        margin-bottom:8px;
      }

      .rf-team-chat-v7 .rf-sidebar-section > header{
        min-height:34px;
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:6px;
        padding:5px 6px;
        color:var(--rftc-muted);
        font-size:5.5px;
        font-weight:800;
        letter-spacing:.05em;
        text-transform:uppercase;
      }

      .rf-team-chat-v7 .rf-sidebar-section button{
        transition:.13s var(--rftc-ease);
      }

      .rf-team-chat-v7 .rf-chat-main{
        min-width:0;
        min-height:0;
        display:grid;
        grid-template-rows:auto auto minmax(0,1fr);
        background:#fff;
      }

      .rf-team-chat-v7 .rf-chat-header{
        min-height:68px;
        display:grid;
        grid-template-columns:minmax(140px,1fr) minmax(170px,.65fr) auto;
        align-items:center;
        gap:10px;
        padding:9px 11px;
        background:#fbfbfc;
        border-bottom:1px solid var(--rftc-line);
      }

      .rf-team-chat-v7 .rf-chat-header > div:first-child{
        min-width:0;
      }

      .rf-team-chat-v7 .rf-chat-header h2{
        margin:0;
        overflow:hidden;
        text-overflow:ellipsis;
        white-space:nowrap;
        font:600 13px/18px Geist,Inter,sans-serif;
        letter-spacing:-.015em;
      }

      .rf-team-chat-v7 .rf-chat-header p{
        margin:2px 0 0;
        overflow:hidden;
        color:var(--rftc-muted);
        text-overflow:ellipsis;
        white-space:nowrap;
        font-size:5.8px;
      }

      .rf-team-chat-v7 .rf-chat-search input{
        width:100%;
        min-height:36px;
        padding:7px 8px;
        color:var(--rftc-text);
        background:#fff;
        border:1px solid var(--rftc-line);
        border-radius:8px;
        outline:0;
        font-size:6.3px;
      }

      .rf-team-chat-v7 .rf-chat-search input:focus{
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rf-team-chat-v7 .rf-chat-header__actions{
        display:flex;
        align-items:center;
        justify-content:flex-end;
        gap:5px;
      }

      .rf-team-chat-v7 .rf-chat-action-button,
      .rf-team-chat-v7 .rf-icon-button{
        min-height:33px;
        display:inline-flex;
        align-items:center;
        justify-content:center;
        gap:5px;
        padding:5px 7px;
        color:var(--rftc-text2);
        background:#fff;
        border:1px solid var(--rftc-line);
        border-radius:7px;
        cursor:pointer;
        font-size:5.5px;
        font-weight:750;
      }

      .rf-team-chat-v7 .rf-chat-action-button--primary{
        color:#fff;
        background:var(--rftc-primary);
        border-color:var(--rftc-primary);
      }

      .rf-team-chat-v7 .rf-chat-action-button:disabled{
        opacity:.42;
        cursor:not-allowed;
      }

      .rf-team-chat-v7 .rf-chat-alert{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:9px 10px;
        margin:8px 9px 0;
        color:#7c1d1d;
        background:var(--rftc-red-soft);
        border:1px solid #ffd0cc;
        border-radius:8px;
        font-size:6.5px;
        line-height:10px;
      }

      .rf-team-chat-v7 .rf-chat-alert button{
        min-height:27px;
        padding:4px 7px;
        color:#7c1d1d;
        background:#fff;
        border:1px solid #ffd0cc;
        border-radius:6px;
        cursor:pointer;
        font-size:5.4px;
        font-weight:750;
      }

      .rf-team-chat-v7 .rf-chat-content{
        min-height:0;
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        overflow:hidden;
      }

      .rf-team-chat-v7 .rf-message-area{
        min-width:0;
        min-height:0;
        display:grid;
        grid-template-rows:minmax(0,1fr) auto auto;
        overflow:hidden;
      }

      .rf-team-chat-v7 .rf-message-list{
        min-height:0;
        overflow-y:auto;
        display:grid;
        align-content:start;
        gap:7px;
        padding:12px;
        background:
          radial-gradient(circle at 95% 5%,rgba(70,72,212,.025),transparent 25%),
          #fff;
        scrollbar-width:thin;
        scrollbar-color:#d9dade transparent;
      }

      .rf-team-chat-v7 .rf-message-block{
        max-width:84%;
        min-width:0;
      }

      .rf-team-chat-v7 .rf-message-block.own,
      .rf-team-chat-v7 .rf-message-block--own{
        justify-self:end;
      }

      .rf-team-chat-v7 .rf-message-meta{
        display:flex;
        align-items:center;
        gap:5px;
        margin-bottom:3px;
        color:var(--rftc-muted);
        font-size:5px;
      }

      .rf-team-chat-v7 .rf-message-content,
      .rf-team-chat-v7 .rf-message-body{
        padding:8px 9px;
        color:var(--rftc-text2);
        background:#f4f5f6;
        border:1px solid #eceeef;
        border-radius:9px;
        font-size:6.5px;
        line-height:11px;
      }

      .rf-team-chat-v7 .rf-message-actions{
        display:flex;
        gap:4px;
        margin-top:4px;
        opacity:.28;
        transition:.13s var(--rftc-ease);
      }

      .rf-team-chat-v7 .rf-message-block:hover .rf-message-actions{
        opacity:1;
      }

      .rf-team-chat-v7 .rf-message-actions button{
        min-height:25px;
        padding:4px 6px;
        color:var(--rftc-text2);
        background:#fff;
        border:1px solid var(--rftc-line);
        border-radius:6px;
        cursor:pointer;
        font-size:5px;
      }

      .rf-team-chat-v7 .rf-message-composer{
        display:grid;
        gap:6px;
        padding:9px 10px 10px;
        background:#fbfbfc;
        border-top:1px solid var(--rftc-line);
      }

      .rf-team-chat-v7 .rf-message-composer__body{
        display:grid;
        grid-template-columns:minmax(0,1fr) auto;
        align-items:end;
        gap:7px;
      }

      .rf-team-chat-v7 .rf-message-composer textarea{
        width:100%;
        min-height:52px;
        max-height:140px;
        resize:vertical;
        padding:9px 10px;
        color:var(--rftc-text);
        background:#fff;
        border:1px solid var(--rftc-line);
        border-radius:9px;
        outline:0;
        font:400 6.5px/11px Inter,sans-serif;
      }

      .rf-team-chat-v7 .rf-message-composer textarea:focus{
        border-color:rgba(70,72,212,.5);
        box-shadow:0 0 0 3px rgba(70,72,212,.06);
      }

      .rf-team-chat-v7 .rf-message-composer button[type="submit"]{
        min-width:82px;
        min-height:38px;
        color:#fff;
        background:var(--rftc-primary);
        border:1px solid var(--rftc-primary);
        border-radius:8px;
        cursor:pointer;
        font-size:5.8px;
        font-weight:750;
      }

      .rf-team-chat-v7 .rf-composer-context{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:7px 8px;
        color:#5c5d7d;
        background:var(--rftc-primary-soft);
        border-radius:7px;
        font-size:5.5px;
      }

      .rf-team-chat-v7 .rf-typing-indicator,
      .rf-team-chat-v7 .rf-typing-space{
        min-height:23px;
        display:flex;
        align-items:center;
        padding:4px 10px;
        color:var(--rftc-muted);
        background:#fbfbfc;
        font-size:5.3px;
      }

      .rf-team-chat-v7 .rf-typing-indicator::before{
        content:"";
        width:5px;
        height:5px;
        margin-right:5px;
        background:var(--rftc-primary);
        border-radius:50%;
        animation:rftcPulse 1s infinite ease-in-out;
      }

      .rf-team-chat-v7 .rf-resource-panel{
        width:260px;
        min-height:0;
        overflow-y:auto;
        padding:10px;
        background:#fafbfb;
        border-left:1px solid var(--rftc-line);
      }

      .rf-team-chat-v7 .rf-resource-panel > header{
        display:flex;
        align-items:flex-start;
        justify-content:space-between;
        gap:8px;
        padding-bottom:8px;
        margin-bottom:8px;
        border-bottom:1px solid var(--rftc-line);
      }

      .rf-team-chat-v7 .rf-resource-panel h3{
        margin:0;
        font:600 10px/14px Geist,Inter,sans-serif;
      }

      .rf-team-chat-v7 .rf-resource-panel p{
        margin:2px 0 0;
        color:var(--rftc-muted);
        font-size:5.5px;
      }

      .rf-team-chat-v7 .rf-resource-add,
      .rf-team-chat-v7 .rf-resource-form button{
        width:100%;
        min-height:35px;
        color:#fff;
        background:var(--rftc-primary);
        border:1px solid var(--rftc-primary);
        border-radius:7px;
        cursor:pointer;
        font-size:5.7px;
        font-weight:750;
      }

      .rf-team-chat-v7 .rf-resource-form{
        display:grid;
        gap:6px;
        margin:7px 0;
      }

      .rf-team-chat-v7 .rf-resource-form input,
      .rf-team-chat-v7 .rf-resource-form textarea{
        width:100%;
        min-height:36px;
        padding:7px 8px;
        color:var(--rftc-text);
        background:#fff;
        border:1px solid var(--rftc-line);
        border-radius:7px;
        outline:0;
        font-size:6px;
      }

      .rf-team-chat-v7 .rf-resource-form textarea{
        min-height:70px;
        resize:vertical;
      }

      .rf-team-chat-v7 .rf-resource-list{
        display:grid;
        gap:5px;
        margin-top:7px;
      }

      .rf-team-chat-v7 .rf-resource-card{
        min-width:0;
        display:grid;
        grid-template-columns:32px minmax(0,1fr);
        align-items:center;
        gap:7px;
        padding:7px;
        color:var(--rftc-text);
        background:#fff;
        border:1px solid var(--rftc-line);
        border-radius:8px;
        text-decoration:none;
      }

      .rf-team-chat-v7 .rf-chat-empty{
        min-height:300px;
        display:grid;
        place-items:center;
        align-content:center;
        gap:5px;
        padding:24px;
        color:var(--rftc-muted);
        text-align:center;
      }

      .rf-team-chat-v7 .rf-chat-empty > div{
        width:48px;
        height:48px;
        display:grid;
        place-items:center;
        color:#fff;
        background:var(--rftc-primary);
        border-radius:12px;
        font-size:8px;
        font-weight:800;
      }

      .rf-team-chat-v7 .rf-chat-empty h3{
        margin:3px 0 0;
        color:var(--rftc-text);
        font:600 12px/17px Geist,Inter,sans-serif;
      }

      .rf-team-chat-v7 .rf-chat-empty p{
        max-width:380px;
        margin:0;
        font-size:6px;
        line-height:10px;
      }

      .rf-team-chat-v7 .rf-modal-backdrop{
        position:fixed;
        z-index:2147481000;
        inset:0;
        display:grid;
        place-items:center;
        padding:18px;
        background:rgba(25,28,29,.58);
        backdrop-filter:blur(8px);
      }

      .rf-team-chat-v7 .rf-group-dialog,
      .rf-team-chat-v7 .rf-call-dialog{
        width:min(620px,100%);
        max-height:calc(100vh - 36px);
        overflow:auto;
        padding:15px;
        background:#fff;
        border:1px solid rgba(255,255,255,.3);
        border-radius:13px;
        box-shadow:0 24px 70px rgba(0,0,0,.18);
      }

      .rf-team-chat-v7 .rf-group-member-list{
        display:grid;
        gap:5px;
        max-height:260px;
        overflow:auto;
        margin-top:8px;
      }

      .rf-team-chat-v7 .rf-group-member{
        min-height:52px;
        display:grid;
        grid-template-columns:15px 34px minmax(0,1fr);
        align-items:center;
        gap:7px;
        padding:7px;
        background:#f7f8f9;
        border-radius:8px;
      }

      .rf-team-chat-v7 .rf-active-call-bar{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:8px;
        padding:8px 10px;
        color:#fff;
        background:var(--rftc-dark);
        border-top:1px solid rgba(255,255,255,.06);
      }

      .rf-team-chat-v7 .rf-call-accept{
        color:#fff;
        background:var(--rftc-green)!important;
        border-color:var(--rftc-green)!important;
      }

      .rf-team-chat-v7 .rf-call-decline{
        color:#fff;
        background:#b42318!important;
        border-color:#b42318!important;
      }

      .rf-team-chat-v7 .rf-team-chat-shell--loading > aside,
      .rf-team-chat-v7 .rf-team-chat-shell--loading section > header,
      .rf-team-chat-v7 .rf-team-chat-shell--loading section > div{
        background:linear-gradient(90deg,#eceef0,#f8f9fa,#eceef0);
        background-size:220% 100%;
        animation:rftcPulse 1.15s infinite ease-in-out;
      }

      @media(max-width:980px){
        .rf-team-chat-v7{
          padding:22px;
        }

        .rf-team-chat-v7 .rf-chat-header{
          grid-template-columns:minmax(140px,1fr) auto;
        }

        .rf-team-chat-v7 .rf-chat-search{
          grid-column:1/-1;
          grid-row:2;
        }
      }

      @media(max-width:760px){
        .rf-team-chat-v7 .rf-team-chat-shell{
          grid-template-columns:205px minmax(0,1fr);
        }

        .rf-team-chat-v7 .rf-resource-panel{
          position:absolute;
          z-index:5;
          right:0;
          top:0;
          bottom:0;
          width:min(290px,85vw);
          box-shadow:-10px 0 28px rgba(25,28,29,.12);
        }
      }

      @media(max-width:620px){
        .rf-team-chat-v7{
          padding:0 0 70px;
        }

        .rf-team-chat-v7 .rf-team-chat-shell{
          min-height:calc(100vh - 70px);
          grid-template-columns:1fr;
          border-left:0;
          border-right:0;
          border-radius:0;
        }

        .rf-team-chat-v7 .rf-chat-sidebar{
          max-height:250px;
          border-right:0;
          border-bottom:1px solid var(--rftc-line);
        }

        .rf-team-chat-v7 .rf-chat-main{
          min-height:560px;
        }

        .rf-team-chat-v7 .rf-chat-header{
          grid-template-columns:1fr;
        }

        .rf-team-chat-v7 .rf-chat-header__actions{
          justify-content:flex-start;
          overflow-x:auto;
        }

        .rf-team-chat-v7 .rf-chat-search{
          grid-column:auto;
          grid-row:auto;
        }

        .rf-team-chat-v7 .rf-message-block{
          max-width:93%;
        }

        .rf-team-chat-v7 .rf-message-composer__body{
          grid-template-columns:1fr;
        }

        .rf-team-chat-v7 .rf-message-composer button[type="submit"]{
          width:100%;
        }

        .rf-team-chat-v7 .rf-modal-backdrop{
          padding:0;
        }

        .rf-team-chat-v7 .rf-group-dialog,
        .rf-team-chat-v7 .rf-call-dialog{
          min-height:100vh;
          max-height:100vh;
          border-radius:0;
        }
      }

      @media(prefers-reduced-motion:reduce){
        .rf-team-chat-v7,
        .rf-team-chat-v7 *,
        .rf-team-chat-v7 *::before,
        .rf-team-chat-v7 *::after{
          animation:none!important;
          transition-duration:.01ms!important;
          scroll-behavior:auto!important;
        }
      }
    `}</style>
  );
}
