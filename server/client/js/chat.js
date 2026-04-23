document.addEventListener("DOMContentLoaded", () => {
  const currentUser = window.AuthStore.getUser();
  if (!currentUser) {
    window.location.replace("/login.html");
    return;
  }

  const $ = (id) => document.getElementById(id);
  const CHAT = { DIRECT: "direct", GROUP: "group" };
  const MSG = { TEXT: "text", IMAGE: "image", GIF: "gif", CALL: "call", DELETED: "deleted" };
  const CALL = { IDLE: "idle", DIALING: "dialing", CONNECTING: "connecting", ACTIVE: "active" };
  const EMOJIS = [
    "\uD83D\uDE00",
    "\uD83D\uDE04",
    "\uD83D\uDE02",
    "\uD83E\uDD73",
    "\uD83D\uDE0D",
    "\uD83D\uDD25",
    "\uD83C\uDF89",
    "\u2764\uFE0F",
    "\uD83D\uDC4D",
    "\uD83E\uDD16",
  ];
  const CALL_ICONS = {
    previewHidden:
      '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v7A2.5 2.5 0 0 1 17.5 17h-11A2.5 2.5 0 0 1 4 14.5z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8 12h8" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><path d="M6 18L18 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/>',
    previewShown:
      '<path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v7A2.5 2.5 0 0 1 17.5 17h-11A2.5 2.5 0 0 1 4 14.5z" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M8.2 12c1.1-1.6 2.4-2.4 3.8-2.4s2.7.8 3.8 2.4c-1.1 1.6-2.4 2.4-3.8 2.4S9.3 13.6 8.2 12z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="1.5" fill="none" stroke="currentColor" stroke-width="1.7"/>',
    micOn:
      '<path d="M12 4.8a2.6 2.6 0 0 1 2.6 2.6v4.9a2.6 2.6 0 1 1-5.2 0V7.4A2.6 2.6 0 0 1 12 4.8z" fill="none" stroke="currentColor" stroke-width="1.9"/><path d="M7.7 11.9a4.3 4.3 0 1 0 8.6 0" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M12 16.2v3.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
    micOff:
      '<path d="M12 4.8a2.6 2.6 0 0 1 2.6 2.6v4.9a2.6 2.6 0 0 1-.6 1.7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M9.8 9.6v2.7a2.2 2.2 0 0 0 3.8 1.5" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M7.7 11.9a4.3 4.3 0 0 0 6.9 3.4" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M12 16.2v3.2" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/><path d="M6.2 6.2l11.6 11.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  };

  const els = {
    currentUserLabel: $("currentUserLabel"),
    currentUserRailAvatar: $("currentUserRailAvatar"),
    activeChatLabel: $("activeChatLabel"),
    mobileBackBtn: $("mobileBackBtn"),
    activeUserAvatar: $("activeUserAvatar"),
    activeUserPresence: $("activeUserPresence"),
    typingIndicator: $("typingIndicator"),
    chatMenuBtn: $("chatMenuBtn"),
    chatMenuPanel: $("chatMenuPanel"),
    menuUserAvatar: $("menuUserAvatar"),
    menuUsername: $("menuUsername"),
    menuUserStatus: $("menuUserStatus"),
    chatMenuExtra: $("chatMenuExtra"),
    announcementToast: $("announcementToast"),
    statusMessage: $("statusMessage"),
    conversationList: $("conversationList"),
    userSearchInput: $("userSearchInput"),
    inviteBtn: $("inviteBtn"),
    inviteBtnLabel: $("inviteBtnLabel"),
    inviteBtnBadge: $("inviteBtnBadge"),
    newGroupBtn: $("newGroupBtn"),
    messagesContainer: $("messagesContainer"),
    messageForm: $("messageForm"),
    messageInput: $("messageInput"),
    emojiPanel: $("emojiPanel"),
    emojiToggleBtn: $("emojiToggleBtn"),
    imageUploadBtn: $("imageUploadBtn"),
    imageInput: $("imageInput"),
    groupAvatarInput: $("groupAvatarInput"),
    gifToggleBtn: $("gifToggleBtn"),
    gifPicker: $("gifPicker"),
    closeGifBtn: $("closeGifBtn"),
    gifSearchInput: $("gifSearchInput"),
    gifResults: $("gifResults"),
    themeToggleBtn: $("themeToggleBtn"),
    refreshUsersBtn: $("refreshUsersBtn"),
    navChatsBtn: $("navChatsBtn"),
    navProfileBtn: $("navProfileBtn"),
    navSettingsBtn: $("navSettingsBtn"),
    navLogoutBtn: $("navLogoutBtn"),
    settingsPanel: $("settingsPanel"),
    closeSettingsBtn: $("closeSettingsBtn"),
    settingsAvatarPreview: $("settingsAvatarPreview"),
    settingsUsernameLabel: $("settingsUsernameLabel"),
    usernameInput: $("usernameInput"),
    saveUsernameBtn: $("saveUsernameBtn"),
    changeAvatarBtn: $("changeAvatarBtn"),
    removeAvatarBtn: $("removeAvatarBtn"),
    profileAvatarInput: $("profileAvatarInput"),
    callToggleBtn: $("callToggleBtn"),
    callDock: $("callDock"),
    callDockMedia: $("callDockMedia"),
    callAvatar: $("callAvatar"),
    callLabel: $("callLabel"),
    callSubLabel: $("callSubLabel"),
    toggleCallViewBtn: $("toggleCallViewBtn"),
    fullscreenCallBtn: $("fullscreenCallBtn"),
    shareScreenBtn: $("shareScreenBtn"),
    muteCallBtn: $("muteCallBtn"),
    endCallBtn: $("endCallBtn"),
    remoteVideoPanel: $("remoteVideoPanel"),
    localVideo: $("localVideo"),
    localVideoFallback: $("localVideoFallback"),
    localVideoLabel: $("localVideoLabel"),
    localVideoPanel: $("localVideoPanel"),
    remoteVideo: $("remoteVideo"),
    remoteVideoFallback: $("remoteVideoFallback"),
    incomingCallModal: $("incomingCallModal"),
    incomingCallLabel: $("incomingCallLabel"),
    acceptCallBtn: $("acceptCallBtn"),
    rejectCallBtn: $("rejectCallBtn"),
    groupModal: $("groupModal"),
    groupModalTitle: $("groupModalTitle"),
    groupModalSubtitle: $("groupModalSubtitle"),
    groupNameField: $("groupNameField"),
    groupNameInput: $("groupNameInput"),
    groupMemberOptions: $("groupMemberOptions"),
    groupModalHint: $("groupModalHint"),
    groupModalStatus: $("groupModalStatus"),
    saveGroupBtn: $("saveGroupBtn"),
    cancelGroupBtn: $("cancelGroupBtn"),
    closeGroupModalBtn: $("closeGroupModalBtn"),
    inviteModal: $("inviteModal"),
    inviteSearchInput: $("inviteSearchInput"),
    inviteUserOptions: $("inviteUserOptions"),
    inviteModalStatus: $("inviteModalStatus"),
    closeInviteModalBtn: $("closeInviteModalBtn"),
    cancelInviteBtn: $("cancelInviteBtn"),
    groupCallModal: $("groupCallModal"),
    groupCallSubtitle: $("groupCallSubtitle"),
    groupCallMemberOptions: $("groupCallMemberOptions"),
    groupCallStatus: $("groupCallStatus"),
    closeGroupCallModalBtn: $("closeGroupCallModalBtn"),
    cancelGroupCallBtn: $("cancelGroupCallBtn"),
    remoteAudio: $("remoteAudio"),
  };

  const state = {
    conversations: [],
    groups: [],
    selectedChatKind: null,
    selectedUserId: null,
    selectedGroupId: null,
    selectedUsername: "",
    selectedAvatarUrl: null,
    messageNodes: new Map(),
    messageStatus: new Map(),
    unread: new Set(),
    unreadGroups: new Set(),
    typingUsers: new Set(),
    typingGroups: new Map(),
    userMap: new Map(),
    typingSentContext: null,
    typingTimer: null,
    gifTimer: null,
    groupEditor: {
      mode: "create",
      groupId: null,
      selectedUserIds: new Set(),
    },
    inviteDirectory: [],
    inviteSearchTerm: "",
    mobileChatOpen: false,
    call: {
      status: CALL.IDLE,
      callId: null,
      peerUserId: null,
      peerConnection: null,
      localStream: null,
      screenStream: null,
      remoteStream: null,
      videoSender: null,
      muted: false,
      screenSharing: false,
      mediaCollapsed: false,
      hasRelayCandidate: false,
      pendingIncoming: null,
      pendingRemoteCandidates: [],
    },
  };

  const socket = io(window.APP_CONFIG.SOCKET_URL, { transports: ["websocket", "polling"] });
  const THEME_KEY = "cryptochat_theme";
  const TYPING_MS = 1200;
  const BOTTOM_GAP = 110;
  const MAX_IMG = 2 * 1024 * 1024;
  const GIF_DEFAULT = "funny";
  const MOBILE_CHAT_BREAKPOINT = 760;
  let announcementHideTimer = null;
  let announcementDismissTimer = null;
  let rtcConfig = {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:stun1.l.google.com:19302" },
      { urls: "stun:stun2.l.google.com:19302" },
      {
        urls: "turn:openrelay.metered.ca:80",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turn:openrelay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
      {
        urls: "turns:openrelay.metered.ca:443?transport=tcp",
        username: "openrelayproject",
        credential: "openrelayproject",
      },
    ],
    iceTransportPolicy: "all",
    iceCandidatePoolSize: 4,
  };

  const norm = (v) => {
    if (v === undefined || v === null) return null;
    const s = String(v).trim();
    return s || null;
  };
  const initials = (u) =>
    (String(u || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join("") || "?");
  const setStatus = (m, err) => {
    els.statusMessage.textContent = m || "";
    els.statusMessage.style.color = err ? "var(--danger)" : "var(--muted)";
  };
  const clearAnnouncementTimers = () => {
    if (announcementHideTimer) {
      clearTimeout(announcementHideTimer);
      announcementHideTimer = null;
    }
    if (announcementDismissTimer) {
      clearTimeout(announcementDismissTimer);
      announcementDismissTimer = null;
    }
  };
  const showAnnouncement = (message, durationMs = 5200) => {
    if (!els.announcementToast || !message) {
      return;
    }

    clearAnnouncementTimers();
    els.announcementToast.textContent = message;
    els.announcementToast.classList.remove("hidden", "hide");

    announcementHideTimer = setTimeout(() => {
      els.announcementToast.classList.add("hide");
      announcementDismissTimer = setTimeout(() => {
        els.announcementToast.classList.add("hidden");
        els.announcementToast.classList.remove("hide");
      }, 280);
    }, Math.max(1500, Number(durationMs) || 5200));
  };
  const t = (v) => {
    const d = new Date(v);
    return Number.isNaN(d.getTime())
      ? ""
      : d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };
  const tConv = (v) => {
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return "";
    const n = new Date();
    if (
      d.getDate() === n.getDate() &&
      d.getMonth() === n.getMonth() &&
      d.getFullYear() === n.getFullYear()
    ) {
      return t(d);
    }
    return `${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };
  const nearBottom = () =>
    els.messagesContainer.scrollHeight -
      els.messagesContainer.scrollTop -
      els.messagesContainer.clientHeight <=
    BOTTOM_GAP;
  const scrollBottom = (force) => {
    if (!force && !nearBottom()) return;
    els.messagesContainer.scrollTop = els.messagesContainer.scrollHeight;
  };

  const isDirectChatSelected = () =>
    state.selectedChatKind === CHAT.DIRECT && Boolean(state.selectedUserId);
  const isGroupChatSelected = () =>
    state.selectedChatKind === CHAT.GROUP && Boolean(state.selectedGroupId);
  const hasSelectedChat = () => isDirectChatSelected() || isGroupChatSelected();

  function getSelectedGroup() {
    return state.groups.find((group) => group.id === state.selectedGroupId) || null;
  }

  function getSelectedChat() {
    return isGroupChatSelected() ? getSelectedGroup() : getSelectedConversation();
  }

  function isMobileViewport() {
    return window.innerWidth <= MOBILE_CHAT_BREAKPOINT;
  }

  function syncMobileLayout() {
    const hasActiveChat = hasSelectedChat();
    const mobileChatOpen = isMobileViewport() && hasActiveChat && state.mobileChatOpen;
    const mobileListView = isMobileViewport() && !mobileChatOpen;

    document.body.classList.toggle("mobile-chat-open", mobileChatOpen);
    document.body.classList.toggle("mobile-list-view", mobileListView);

    if (els.mobileBackBtn) {
      els.mobileBackBtn.classList.toggle("hidden", !mobileChatOpen);
    }
  }

  function openMobileChatView() {
    if (!isMobileViewport()) {
      return;
    }

    state.mobileChatOpen = true;
    syncMobileLayout();
  }

  function showMobileConversationList() {
    state.mobileChatOpen = false;
    toggleChatMenu(false);
    setSettings(false);
    syncMobileLayout();

    if (isMobileViewport()) {
      els.userSearchInput.focus();
    }
  }

  function getUserProfile(userId) {
    const normalizedUserId = Number(userId);
    if (!normalizedUserId) {
      return null;
    }

    const conversation = state.conversations.find((item) => item.userId === normalizedUserId);
    if (conversation) {
      return {
        id: conversation.userId,
        userId: conversation.userId,
        username: conversation.username,
        avatarUrl: norm(conversation.avatarUrl),
        online: Boolean(conversation.online),
      };
    }

    const user = state.userMap.get(normalizedUserId);
    return {
      id: normalizedUserId,
      userId: normalizedUserId,
      username: (user && user.username) || `User ${normalizedUserId}`,
      avatarUrl: norm(user && user.avatarUrl),
      online: Boolean(user && user.online),
    };
  }

  function getCallableGroupMembers() {
    const selectedGroup = getSelectedGroup();
    if (!selectedGroup) {
      return [];
    }

    return (selectedGroup.members || [])
      .filter((member) => member.id !== currentUser.id && member.online)
      .map((member) => ({
        id: Number(member.id),
        username: member.username || `User ${member.id}`,
        avatarUrl: norm(member.avatarUrl),
        online: Boolean(member.online),
      }))
      .sort((left, right) => left.username.localeCompare(right.username));
  }

  function getGroupTypingSet(groupId) {
    if (!state.typingGroups.has(groupId)) {
      state.typingGroups.set(groupId, new Set());
    }
    return state.typingGroups.get(groupId);
  }

  function clearGroupTyping(groupId, userId) {
    const typingSet = state.typingGroups.get(groupId);
    if (!typingSet) {
      return;
    }

    if (userId) {
      typingSet.delete(userId);
    }

    if (!typingSet.size || !userId) {
      state.typingGroups.delete(groupId);
    }
  }

  function setInviteModalStatus(message, isError) {
    if (!els.inviteModalStatus) {
      return;
    }

    els.inviteModalStatus.textContent = message || "";
    els.inviteModalStatus.style.color = isError ? "var(--danger)" : "var(--muted)";
  }

  function getInvitePriority(user) {
    switch (user && user.directRelationStatus) {
      case "incoming_pending":
        return 0;
      case "none":
        return 1;
      case "outgoing_pending":
        return 2;
      case "accepted":
        return 3;
      default:
        return 4;
    }
  }

  function countIncomingInvites() {
    return state.inviteDirectory.filter((user) => user.directRelationStatus === "incoming_pending").length;
  }

  function updateInviteButtonState() {
    const incomingCount = countIncomingInvites();
    if (els.inviteBtnLabel) {
      els.inviteBtnLabel.textContent = "Add Friends";
    }
    if (els.inviteBtn) {
      const label = incomingCount
        ? `Add Friends (${incomingCount} pending request${incomingCount === 1 ? "" : "s"})`
        : "Add Friends";
      els.inviteBtn.setAttribute("title", label);
      els.inviteBtn.setAttribute("aria-label", label);
    }
    if (els.inviteBtnBadge) {
      els.inviteBtnBadge.textContent = String(incomingCount);
      els.inviteBtnBadge.classList.toggle("hidden", incomingCount < 1);
    }
  }

  async function loadInviteDirectory() {
    try {
      const { users = [] } = await window.Api.fetchUsers(currentUser.id, "", currentUser.id);
      state.inviteDirectory = users
        .map((user) => {
          const normalizedUser = {
            id: Number(user.id),
            username: user.username || `User ${user.id}`,
            avatarUrl: norm(user.avatarUrl),
            online: Boolean(user.online),
            directInviteId: user.directInviteId ? Number(user.directInviteId) : null,
            directRelationStatus: user.directRelationStatus || "none",
          };
          state.userMap.set(normalizedUser.id, {
            username: normalizedUser.username,
            avatarUrl: normalizedUser.avatarUrl,
            online: normalizedUser.online,
          });
          return normalizedUser;
        })
        .sort((left, right) => {
          const priorityDiff = getInvitePriority(left) - getInvitePriority(right);
          return priorityDiff || left.username.localeCompare(right.username);
        });

      updateInviteButtonState();
      if (els.inviteModal && !els.inviteModal.classList.contains("hidden")) {
        renderInviteDirectory();
      }
    } catch (error) {
      setInviteModalStatus(error.message, true);
      setStatus(error.message, true);
    }
  }

  function renderInviteDirectory() {
    if (!els.inviteUserOptions) {
      return;
    }

    els.inviteUserOptions.innerHTML = "";
    const filterTerm = String(state.inviteSearchTerm || "").trim().toLowerCase();
    const visibleUsers = state.inviteDirectory.filter((user) =>
      !filterTerm || user.username.toLowerCase().includes(filterTerm)
    );

    if (!visibleUsers.length) {
      const empty = document.createElement("p");
      empty.className = "status";
      empty.textContent = filterTerm
        ? "No users match your search."
        : "No users available yet.";
      els.inviteUserOptions.appendChild(empty);
      return;
    }

    visibleUsers.forEach((user) => {
      const row = document.createElement("div");
      row.className = "group-member-option invite-option";

      const main = document.createElement("div");
      main.className = "group-member-option-main";

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      paintAvatar(avatar, user.username, user.avatarUrl);

      const meta = document.createElement("div");
      meta.className = "group-member-option-meta";

      const name = document.createElement("p");
      name.className = "group-member-option-name";
      name.textContent = user.username;

      const status = document.createElement("p");
      status.className = "group-member-option-status";
      status.textContent = user.online ? "Online" : "Offline";

      meta.append(name, status);
      main.append(avatar, meta);

      const actions = document.createElement("div");
      actions.className = "invite-option-actions";

      if (user.directRelationStatus === "accepted") {
        const pill = document.createElement("span");
        pill.className = "invite-pill connected";
        pill.textContent = "Friends";
        actions.appendChild(pill);
      } else if (user.directRelationStatus === "outgoing_pending") {
        const pill = document.createElement("span");
        pill.className = "invite-pill pending";
        pill.textContent = "Requested";
        actions.appendChild(pill);
      } else if (user.directRelationStatus === "incoming_pending" && user.directInviteId) {
        const acceptBtn = document.createElement("button");
        acceptBtn.type = "button";
        acceptBtn.className = "secondary-btn";
        acceptBtn.textContent = "Accept";
        acceptBtn.addEventListener("click", async () => {
          await respondDirectInvite(user.directInviteId, "accept");
        });

        const declineBtn = document.createElement("button");
        declineBtn.type = "button";
        declineBtn.className = "secondary-btn";
        declineBtn.textContent = "Ignore";
        declineBtn.addEventListener("click", async () => {
          await respondDirectInvite(user.directInviteId, "reject");
        });

        actions.append(acceptBtn, declineBtn);
      } else {
        const inviteBtn = document.createElement("button");
        inviteBtn.type = "button";
        inviteBtn.className = "secondary-btn";
        inviteBtn.textContent = "Add";
        inviteBtn.addEventListener("click", async () => {
          await sendDirectInvite(user.id);
        });
        actions.appendChild(inviteBtn);
      }

      row.append(main, actions);
      els.inviteUserOptions.appendChild(row);
    });
  }

  async function sendDirectInvite(userId) {
    try {
      setInviteModalStatus("", false);
      if (socket.connected) {
        await emitAck("send_direct_invite", {
          senderId: currentUser.id,
          receiverId: userId,
        });
      } else {
        await window.Api.sendDirectInvite(currentUser.id, userId);
      }

      await loadInviteDirectory();
      setInviteModalStatus("Friend request sent.", false);
    } catch (error) {
      setInviteModalStatus(error.message, true);
    }
  }

  async function respondDirectInvite(inviteId, action) {
    try {
      setInviteModalStatus("", false);
      if (socket.connected) {
        await emitAck("respond_direct_invite", {
          inviteId,
          userId: currentUser.id,
          action,
        });
      } else {
        await window.Api.respondDirectInvite(inviteId, currentUser.id, action);
      }

      await refreshChatLists();
      setInviteModalStatus(
        action === "accept" ? "Friend request accepted." : "Friend request ignored.",
        false
      );
    } catch (error) {
      setInviteModalStatus(error.message, true);
    }
  }

  async function openInviteModal() {
    setInviteModalStatus("", false);
    toggleChatMenu(false);
    setSettings(false);
    els.inviteModal.classList.remove("hidden");
    els.inviteSearchInput.value = state.inviteSearchTerm;
    await loadInviteDirectory();
    renderInviteDirectory();
    els.inviteSearchInput.focus();
  }

  function closeInviteModal() {
    setInviteModalStatus("", false);
    els.inviteModal.classList.add("hidden");
  }

  function getGroupTypingLabel(group) {
    if (!group) {
      return "";
    }

    const typingSet = state.typingGroups.get(group.id);
    if (!typingSet || !typingSet.size) {
      return "";
    }

    const typingNames = Array.from(typingSet)
      .map((userId) => {
        const member = (group.members || []).find((item) => item.id === userId);
        const user = state.userMap.get(userId);
        return (member && member.username) || (user && user.username) || `User ${userId}`;
      })
      .filter(Boolean);

    if (!typingNames.length) {
      return "";
    }
    if (typingNames.length === 1) {
      return `${typingNames[0]} is typing`;
    }
    if (typingNames.length === 2) {
      return `${typingNames[0]} and ${typingNames[1]} are typing`;
    }
    return `${typingNames.length} people are typing`;
  }

  function toggleChatMenu(show) {
    els.chatMenuPanel.classList.toggle("hidden", !show);
  }

  function renderChatMenu() {
    els.chatMenuExtra.innerHTML = "";

    if (isGroupChatSelected()) {
      const selectedGroup = getSelectedGroup();
      if (!selectedGroup) {
        paintAvatar(els.menuUserAvatar, "?", null);
        els.menuUsername.textContent = "No conversation selected";
        els.menuUserStatus.textContent = "";
        els.menuUserStatus.style.color = "var(--muted)";
        return;
      }

      paintAvatar(els.menuUserAvatar, selectedGroup.name, selectedGroup.avatarUrl);
      els.menuUsername.textContent = selectedGroup.name;
      els.menuUserStatus.textContent = `${selectedGroup.members.length} members`;
      els.menuUserStatus.style.color = "var(--muted)";

      const changePhotoBtn = document.createElement("button");
      changePhotoBtn.type = "button";
      changePhotoBtn.className = "secondary-btn";
      changePhotoBtn.textContent = selectedGroup.avatarUrl ? "Change Photo" : "Add Photo";
      changePhotoBtn.addEventListener("click", () => {
        toggleChatMenu(false);
        els.groupAvatarInput.click();
      });

      const removePhotoBtn = document.createElement("button");
      removePhotoBtn.type = "button";
      removePhotoBtn.className = "secondary-btn";
      removePhotoBtn.textContent = "Remove Photo";
      removePhotoBtn.disabled = !selectedGroup.avatarUrl;
      removePhotoBtn.addEventListener("click", async () => {
        toggleChatMenu(false);
        await updateGroupAvatar(null);
      });

      const addMemberBtn = document.createElement("button");
      addMemberBtn.type = "button";
      addMemberBtn.className = "secondary-btn";
      addMemberBtn.textContent = "Add Members";
      addMemberBtn.addEventListener("click", () => {
        toggleChatMenu(false);
        openGroupEditor("add", selectedGroup.id);
      });

      const leaveGroupBtn = document.createElement("button");
      leaveGroupBtn.type = "button";
      leaveGroupBtn.className = "danger-btn";
      leaveGroupBtn.textContent = "Leave Group";
      leaveGroupBtn.addEventListener("click", async () => {
        await leaveSelectedGroup();
      });

      const heading = document.createElement("p");
      heading.className = "chat-menu-heading";
      heading.textContent = "Members";

      const membersWrap = document.createElement("div");
      membersWrap.className = "chat-menu-members";

      (selectedGroup.members || []).forEach((member) => {
        const row = document.createElement("div");
        row.className = "chat-menu-member";

        const avatar = document.createElement("div");
        avatar.className = "avatar";
        paintAvatar(avatar, member.username, member.avatarUrl);

        const meta = document.createElement("div");
        meta.className = "chat-menu-member-meta";

        const name = document.createElement("p");
        name.className = "chat-menu-member-name";
        name.textContent = member.id === currentUser.id ? `${member.username} (You)` : member.username;

        const status = document.createElement("p");
        status.className = "chat-menu-member-status";
        status.textContent = member.online ? "Online" : "Offline";

        meta.append(name, status);
        row.append(avatar, meta);
        membersWrap.appendChild(row);
      });

      els.chatMenuExtra.append(
        changePhotoBtn,
        removePhotoBtn,
        addMemberBtn,
        leaveGroupBtn,
        heading,
        membersWrap
      );
      return;
    }

    const selected = getSelectedConversation();
    if (!selected) {
      paintAvatar(els.menuUserAvatar, "?", null);
      els.menuUsername.textContent = "No conversation selected";
      els.menuUserStatus.textContent = "Offline";
      els.menuUserStatus.style.color = "var(--muted)";
      return;
    }

    paintAvatar(els.menuUserAvatar, selected.username, selected.avatarUrl);
    els.menuUsername.textContent = selected.username;
    els.menuUserStatus.textContent = selected.online ? "Online" : "Offline";
    els.menuUserStatus.style.color = selected.online ? "#15814a" : "var(--muted)";
  }
  const isOpenDirectMessage = (m) =>
    isDirectChatSelected() &&
    ((m.senderId === currentUser.id && m.receiverId === state.selectedUserId) ||
      (m.senderId === state.selectedUserId && m.receiverId === currentUser.id));
  const isOpenGroupMessage = (m) =>
    isGroupChatSelected() && Number(m && m.groupId) === Number(state.selectedGroupId);
  const isOpenConv = (m) => isOpenDirectMessage(m) || isOpenGroupMessage(m);
  const preview = (type, text) => {
    if (type === MSG.DELETED) return "Message deleted";
    if (type === MSG.CALL) return "Voice call";
    if (type === MSG.IMAGE) return text ? `Photo: ${text}` : "Photo";
    if (type === MSG.GIF) return text ? `GIF: ${text}` : "GIF";
    return (String(text || "").replace(/\s+/g, " ").trim() || "Start chatting").slice(0, 70);
  };
  const messageKey = (messageOrId, kind = CHAT.DIRECT, groupId = null) => {
    if (messageOrId && typeof messageOrId === "object") {
      if (messageOrId.groupId) {
        return `${CHAT.GROUP}:${messageOrId.groupId}:${messageOrId.id}`;
      }
      return `${CHAT.DIRECT}:${messageOrId.id}`;
    }

    return kind === CHAT.GROUP
      ? `${CHAT.GROUP}:${groupId}:${messageOrId}`
      : `${CHAT.DIRECT}:${messageOrId}`;
  };

  function paintAvatar(node, username, avatarUrl) {
    node.innerHTML = "";
    const url = norm(avatarUrl);
    if (url) {
      const img = document.createElement("img");
      img.className = "avatar-image";
      img.src = url;
      img.alt = `${username || "User"} avatar`;
      node.appendChild(img);
      return;
    }
    node.textContent = initials(username);
  }

  function renderCurrentUser() {
    els.currentUserLabel.textContent = `@${currentUser.username}`;
    els.settingsUsernameLabel.textContent = currentUser.username;
    if (els.usernameInput) {
      els.usernameInput.value = currentUser.username;
    }
    paintAvatar(els.currentUserRailAvatar, currentUser.username, currentUser.avatarUrl);
    paintAvatar(els.settingsAvatarPreview, currentUser.username, currentUser.avatarUrl);
  }

  function applyTheme(theme) {
    const dark = theme === "dark";
    document.body.classList.toggle("theme-dark", dark);
    els.themeToggleBtn.textContent = dark ? "Light Mode" : "Dark Mode";
  }

  function setSettings(show) {
    els.settingsPanel.classList.toggle("hidden", !show);
  }

  function getSelectedConversation() {
    return state.conversations.find((c) => c.userId === state.selectedUserId) || null;
  }

  function updateCallButtonState() {
    const selected = getSelectedConversation();
    const callBusy = Boolean(state.call.callId || state.call.pendingIncoming);
    const liveCall = Boolean(state.call.callId);
    const callableGroupMembers = isGroupChatSelected() ? getCallableGroupMembers() : [];
    const canStartCall =
      !callBusy &&
      ((isDirectChatSelected() &&
        Boolean(selected && selected.online && selected.userId !== currentUser.id)) ||
        (isGroupChatSelected() && callableGroupMembers.length > 0));

    if (els.callToggleBtn) {
      els.callToggleBtn.disabled = !canStartCall;
      els.callToggleBtn.classList.toggle("active", callBusy);
      els.callToggleBtn.title = isGroupChatSelected() ? "Call an online group member" : "Start call";
      els.callToggleBtn.setAttribute(
        "aria-label",
        isGroupChatSelected() ? "Call an online group member" : "Start call"
      );
    }

    if (els.shareScreenBtn) {
      els.shareScreenBtn.disabled = !liveCall;
    }

    if (els.toggleCallViewBtn) {
      els.toggleCallViewBtn.disabled = !callHasExpandedMedia();
    }

    if (els.fullscreenCallBtn) {
      els.fullscreenCallBtn.disabled = !callHasExpandedMedia();
    }

    syncCallControlButtons();
  }

  function updatePresenceLabel() {
    if (!els.activeUserPresence) {
      return;
    }

    if (!hasSelectedChat()) {
      els.activeUserPresence.textContent = "";
      els.activeUserPresence.classList.add("hidden");
      return;
    }

    els.activeUserPresence.classList.remove("hidden");
    if (isGroupChatSelected()) {
      const selectedGroup = getSelectedGroup();
      if (!selectedGroup) {
        els.activeUserPresence.textContent = "";
        els.activeUserPresence.classList.add("hidden");
        return;
      }

      const onlineMembers = (selectedGroup.members || []).filter((member) => member.online).length;
      els.activeUserPresence.textContent = `${selectedGroup.members.length} members | ${onlineMembers} online`;
      els.activeUserPresence.style.color = "var(--muted)";
      return;
    }

    const selected = getSelectedConversation();
    els.activeUserPresence.textContent = selected && selected.online ? "Online" : "Offline";
    els.activeUserPresence.style.color = selected && selected.online ? "#15814a" : "var(--muted)";
  }

  function renderConversations() {
    const previousScrollTop = els.conversationList.scrollTop;
    const term = els.userSearchInput.value.trim().toLowerCase();
    els.conversationList.innerHTML = "";
    const directList = state.conversations.filter((c) => c.username.toLowerCase().includes(term));
    const groupList = state.groups.filter((group) => group.name.toLowerCase().includes(term));

    if (!directList.length && !groupList.length) {
      const p = document.createElement("p");
      p.className = "status";
      p.textContent = "No matching chats.";
      els.conversationList.appendChild(p);
      return;
    }

    const appendSection = (title, items, renderItem) => {
      if (!items.length) {
        return;
      }

      const section = document.createElement("section");
      section.className = "conversation-section";

      const heading = document.createElement("p");
      heading.className = "conversation-section-title";
      heading.textContent = title;
      section.appendChild(heading);

      items.forEach((item) => section.appendChild(renderItem(item)));
      els.conversationList.appendChild(section);
    };

    appendSection("Groups", groupList, (group) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "conversation-item";
      if (isGroupChatSelected() && group.id === state.selectedGroupId) b.classList.add("active");
      if (state.unreadGroups.has(group.id)) b.classList.add("unread");

      const av = document.createElement("div");
      av.className = "avatar";
      paintAvatar(av, group.name, group.avatarUrl);

      const main = document.createElement("div");
      main.className = "conversation-main";

      const top = document.createElement("div");
      top.className = "conversation-top";

      const identity = document.createElement("span");
      identity.className = "conversation-identity";

      const badge = document.createElement("span");
      badge.className = "conversation-badge";
      badge.textContent = "Group";

      const name = document.createElement("span");
      name.className = "conversation-username";
      name.textContent = group.name;

      identity.append(badge, name);

      const tm = document.createElement("span");
      tm.className = "conversation-time";
      tm.textContent = group.lastMessage ? tConv(group.lastMessage.createdAt) : "";

      top.append(identity, tm);

      const pv = document.createElement("div");
      pv.className = "conversation-preview";
      pv.textContent = getGroupTypingLabel(group) || (group.lastMessage ? group.lastMessage.preview : "Start the conversation");

      main.append(top, pv);
      b.append(av, main);
      b.addEventListener("click", () => selectGroup(group.id));
      return b;
    });

    appendSection("Direct Messages", directList, (c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "conversation-item";
      if (isDirectChatSelected() && c.userId === state.selectedUserId) b.classList.add("active");
      if (state.unread.has(c.userId)) b.classList.add("unread");

      const av = document.createElement("div");
      av.className = "avatar";
      paintAvatar(av, c.username, c.avatarUrl);

      const main = document.createElement("div");
      main.className = "conversation-main";
      const top = document.createElement("div");
      top.className = "conversation-top";

      const identity = document.createElement("span");
      identity.className = "conversation-identity";

      const dot = document.createElement("span");
      dot.className = `conversation-presence-dot ${c.online ? "online" : ""}`;

      const u = document.createElement("span");
      u.className = "conversation-username";
      u.textContent = c.username;
      identity.append(dot, u);

      const tm = document.createElement("span");
      tm.className = "conversation-time";
      tm.textContent = c.lastMessage ? tConv(c.lastMessage.createdAt) : "";
      top.append(identity, tm);

      const pv = document.createElement("div");
      pv.className = "conversation-preview";
      pv.textContent = state.typingUsers.has(c.userId)
        ? "Typing..."
        : c.lastMessage
          ? c.lastMessage.preview
          : "Say hello";
      main.append(top, pv);
      b.append(av, main);
      b.addEventListener("click", () => selectConversation(c.userId));
      return b;
    });

    const maxScroll = Math.max(0, els.conversationList.scrollHeight - els.conversationList.clientHeight);
    els.conversationList.scrollTop = Math.min(previousScrollTop, maxScroll);
  }

  function setHeader() {
    if (!hasSelectedChat()) {
      els.activeChatLabel.textContent = "Select a conversation";
      paintAvatar(els.activeUserAvatar, "?", null);
      els.typingIndicator.classList.add("hidden");
      els.typingIndicator.textContent = "";
      updatePresenceLabel();
      updateCallButtonState();
      renderChatMenu();
      syncMobileLayout();
      return;
    }

    els.activeChatLabel.textContent = state.selectedUsername;
    paintAvatar(els.activeUserAvatar, state.selectedUsername, state.selectedAvatarUrl);

    const typingText = isGroupChatSelected()
      ? getGroupTypingLabel(getSelectedGroup())
      : state.typingUsers.has(state.selectedUserId)
        ? `${state.selectedUsername} is typing`
        : "";

    if (typingText) {
      els.typingIndicator.textContent = typingText;
      els.typingIndicator.classList.remove("hidden");
    } else {
      els.typingIndicator.textContent = "";
      els.typingIndicator.classList.add("hidden");
    }
    updatePresenceLabel();
    updateCallButtonState();
    renderChatMenu();
    syncMobileLayout();
  }

  function sortConversations() {
    state.conversations.sort((a, b) => {
      const at = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bt = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bt - at || a.username.localeCompare(b.username);
    });
  }

  function sortGroups() {
    state.groups.sort((a, b) => {
      const at = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bt = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bt - at || a.name.localeCompare(b.name);
    });
  }

  function htmlWithLinks(text) {
    const out = document.createElement("p");
    out.className = "message-text";
    const src = String(text || "");
    const re = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
    let i = 0;
    let m = re.exec(src);
    while (m) {
      addText(out, src.slice(i, m.index));
      const url = m[0];
      const a = document.createElement("a");
      a.href = url.startsWith("http") ? url : `https://${url}`;
      a.textContent = url;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      out.appendChild(a);
      i = m.index + url.length;
      m = re.exec(src);
    }
    addText(out, src.slice(i));
    return out;
  }

  function addText(node, text) {
    String(text || "")
      .split("\n")
      .forEach((line, idx, arr) => {
        node.appendChild(document.createTextNode(line));
        if (idx < arr.length - 1) node.appendChild(document.createElement("br"));
      });
  }

  function messageNode(m) {
    const self = m.senderId === currentUser.id;
    const key = messageKey(m);
    const row = document.createElement("article");
    row.className = `message-row ${self ? "self" : "other"}`;
    row.dataset.messageId = String(m.id);
    row.dataset.messageKey = key;

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
    if (m.groupId && !self) {
      const sender = document.createElement("p");
      sender.className = "message-sender";
      sender.textContent = m.senderUsername || `User ${m.senderId}`;
      bubble.appendChild(sender);
    }
    if ((m.messageType === MSG.IMAGE || m.messageType === MSG.GIF) && m.mediaUrl) {
      const img = document.createElement("img");
      img.className = "message-media";
      img.src = m.mediaUrl;
      img.alt = m.messageType === MSG.GIF ? "GIF message" : "Image message";
      img.loading = "lazy";
      bubble.appendChild(img);
    }
    if (m.messageType === MSG.DELETED) {
      const p = document.createElement("p");
      p.className = "message-deleted";
      p.textContent = "This message was deleted.";
      bubble.appendChild(p);
    } else if (m.messageType === MSG.CALL) {
      const callWrap = document.createElement("div");
      callWrap.className = "message-call";

      const icon = document.createElement("span");
      icon.className = "message-call-icon";
      icon.innerHTML =
        '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5.5 4.5a2 2 0 0 1 2.2-1.96l2.44.26a2 2 0 0 1 1.75 1.45l.5 1.8a2 2 0 0 1-.58 2.02L10.37 9.5a14.62 14.62 0 0 0 4.14 4.14l1.43-1.43a2 2 0 0 1 2.02-.58l1.8.5a2 2 0 0 1 1.45 1.75l.26 2.44a2 2 0 0 1-1.96 2.2h-1A15 15 0 0 1 4.5 5.5v-1z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>';

      const copy = document.createElement("div");
      copy.className = "message-call-copy";

      const title = document.createElement("p");
      title.className = "message-call-title";
      title.textContent = self ? "You started a call" : "Voice call";

      const subtitle = document.createElement("p");
      subtitle.className = "message-call-subtitle";
      subtitle.textContent = self ? "Call activity saved to this chat." : "Call activity shared in this chat.";

      copy.append(title, subtitle);
      callWrap.append(icon, copy);
      bubble.appendChild(callWrap);
    } else if (String(m.message || "").trim()) {
      bubble.appendChild(htmlWithLinks(m.message));
    }
    row.appendChild(bubble);

    const meta = document.createElement("footer");
    meta.className = "message-meta";
    const tm = document.createElement("span");
    tm.textContent = t(m.createdAt);
    meta.appendChild(tm);

    if (self) {
      const st = document.createElement("span");
      st.dataset.messageStatus = "1";
      st.textContent = m.messageType === MSG.DELETED ? "" : state.messageStatus.get(key) || m.status || "sent";
      meta.appendChild(st);
      if (m.messageType !== MSG.DELETED && !m.groupId) {
        const del = document.createElement("button");
        del.type = "button";
        del.className = "delete-message-btn";
        del.textContent = "Delete";
        del.addEventListener("click", () => deleteMessage(m.id));
        meta.appendChild(del);
      }
    }
    row.appendChild(meta);
    return row;
  }

  function upsertMessage(m, force) {
    if (!m || !m.id) return;
    const key = messageKey(m);
    if (m.status) state.messageStatus.set(key, m.status);
    if (m.messageType === MSG.DELETED) state.messageStatus.delete(key);
    const keepBottom = force || nearBottom() || m.senderId === currentUser.id;
    const old = state.messageNodes.get(key);
    const node = messageNode(m);
    if (old) old.replaceWith(node);
    else els.messagesContainer.appendChild(node);
    state.messageNodes.set(key, node);
    if (keepBottom) scrollBottom(true);
  }

  function updateStatus(id, status) {
    if (!id || !status) return;
    const key = messageKey(id, CHAT.DIRECT);
    state.messageStatus.set(key, status);
    const node = state.messageNodes.get(key);
    if (!node) return;
    const st = node.querySelector("[data-message-status]");
    if (st) st.textContent = status;
  }

  async function loadConversations() {
    try {
      const { conversations = [] } = await window.Api.fetchConversations(currentUser.id);
      state.userMap.clear();
      state.conversations = conversations.map((c) => {
        const x = {
          userId: c.userId,
          username: c.username,
          avatarUrl: norm(c.avatarUrl),
          online: Boolean(c.online),
          lastMessage: c.lastMessage || null,
        };
        state.userMap.set(x.userId, {
          username: x.username,
          avatarUrl: x.avatarUrl,
          online: x.online,
        });
        return x;
      });
      sortConversations();
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  async function loadGroups() {
    try {
      const { groups = [] } = await window.Api.fetchGroups(currentUser.id);
      state.groups = groups.map((group) => ({
        id: group.id,
        name: group.name,
        avatarUrl: norm(group.avatarUrl),
        createdAt: group.createdAt,
        members: Array.isArray(group.members)
          ? group.members.map((member) => {
              const normalizedMember = {
                id: Number(member.id),
                username: member.username || `User ${member.id}`,
                avatarUrl: norm(member.avatarUrl),
                online: Boolean(member.online),
              };
              state.userMap.set(normalizedMember.id, {
                username: normalizedMember.username,
                avatarUrl: normalizedMember.avatarUrl,
                online: normalizedMember.online,
              });
              return normalizedMember;
            })
          : [],
        lastMessage: group.lastMessage || null,
      }));
      sortGroups();
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  async function ensureActiveSelection() {
    if (isGroupChatSelected() && state.groups.some((group) => group.id === state.selectedGroupId)) {
      const group = getSelectedGroup();
      state.selectedUsername = group.name;
      state.selectedAvatarUrl = group.avatarUrl;
      setHeader();
      renderConversations();
      await loadMessages();
      syncMobileLayout();
      return;
    }

    if (isDirectChatSelected() && state.conversations.some((c) => c.userId === state.selectedUserId)) {
      const conversation = getSelectedConversation();
      state.selectedUsername = conversation.username;
      state.selectedAvatarUrl = conversation.avatarUrl;
      setHeader();
      renderConversations();
      await loadMessages();
      syncMobileLayout();
      return;
    }

    if (state.conversations.length) {
      await selectConversation(state.conversations[0].userId, { openMobileView: false });
      return;
    }

    if (state.groups.length) {
      await selectGroup(state.groups[0].id, { openMobileView: false });
      return;
    }

    state.selectedChatKind = null;
    state.selectedUserId = null;
    state.selectedGroupId = null;
    state.selectedUsername = "";
    state.selectedAvatarUrl = null;
    state.messageNodes.clear();
    els.messagesContainer.innerHTML = "";
    state.mobileChatOpen = false;
    setHeader();
    renderConversations();
    setStatus("No chats available yet.", false);
    syncMobileLayout();
  }

  async function refreshChatLists() {
    await Promise.all([
      loadConversations(),
      loadGroups(),
      loadInviteDirectory(),
    ]);
    renderConversations();
    await ensureActiveSelection();
  }

  async function loadMessages() {
    if (!hasSelectedChat()) return;
    try {
      const { messages = [] } = isGroupChatSelected()
        ? await window.Api.fetchGroupMessages(state.selectedGroupId, currentUser.id)
        : await window.Api.fetchMessages(state.selectedUserId, currentUser.id);
      state.messageNodes.clear();
      els.messagesContainer.innerHTML = "";
      const f = document.createDocumentFragment();
      messages.forEach((m) => {
        const key = messageKey(m);
        if (m.status) state.messageStatus.set(key, m.status);
        const n = messageNode(m);
        state.messageNodes.set(key, n);
        f.appendChild(n);
      });
      els.messagesContainer.appendChild(f);
      scrollBottom(true);
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  async function selectConversation(userId, options = {}) {
    const c = state.conversations.find((it) => it.userId === userId);
    if (!c) return;
    if (!isDirectChatSelected() || state.selectedUserId !== userId) stopTyping();
    closeGroupCallModal();
    toggleChatMenu(false);
    state.selectedChatKind = CHAT.DIRECT;
    state.selectedUserId = userId;
    state.selectedGroupId = null;
    state.selectedUsername = c.username;
    state.selectedAvatarUrl = c.avatarUrl;
    state.unread.delete(userId);
    state.typingUsers.delete(userId);
    if (options.openMobileView !== false) {
      openMobileChatView();
    } else {
      syncMobileLayout();
    }
    setHeader();
    renderConversations();
    await loadMessages();
    if (!isMobileViewport()) {
      els.messageInput.focus();
    }
  }

  async function selectGroup(groupId, options = {}) {
    const group = state.groups.find((item) => item.id === groupId);
    if (!group) return;
    if (!isGroupChatSelected() || state.selectedGroupId !== groupId) stopTyping();
    closeGroupCallModal();
    toggleChatMenu(false);
    state.selectedChatKind = CHAT.GROUP;
    state.selectedGroupId = groupId;
    state.selectedUserId = null;
    state.selectedUsername = group.name;
    state.selectedAvatarUrl = group.avatarUrl;
    state.unreadGroups.delete(groupId);
    clearGroupTyping(groupId);
    if (options.openMobileView !== false) {
      openMobileChatView();
    } else {
      syncMobileLayout();
    }
    setHeader();
    renderConversations();
    await loadMessages();
    if (!isMobileViewport()) {
      els.messageInput.focus();
    }
  }

  function updateConvFromMessage(m) {
    const uid = m.senderId === currentUser.id ? m.receiverId : m.senderId;
    let c = state.conversations.find((x) => x.userId === uid);
    if (!c) {
      const ref = state.userMap.get(uid) || {};
      c = {
        userId: uid,
        username: ref.username || `User ${uid}`,
        avatarUrl: ref.avatarUrl || null,
        online: Boolean(ref.online),
        lastMessage: null,
      };
      state.conversations.push(c);
    }
    c.lastMessage = { id: m.id, senderId: m.senderId, messageType: m.messageType, preview: preview(m.messageType, m.message), createdAt: m.createdAt };
    sortConversations();
    renderConversations();
  }

  function updateGroupFromMessage(m) {
    if (!m || !m.groupId) {
      return;
    }

    let group = state.groups.find((item) => item.id === m.groupId);
    if (!group) {
      group = {
        id: m.groupId,
        name: `Group ${m.groupId}`,
        avatarUrl: null,
        createdAt: m.createdAt,
        members: [],
        lastMessage: null,
      };
      state.groups.push(group);
    }

    const authorLabel = m.senderId === currentUser.id ? "You" : m.senderUsername || `User ${m.senderId}`;
    group.lastMessage = {
      id: m.id,
      groupId: m.groupId,
      senderId: m.senderId,
      senderUsername: m.senderUsername || null,
      messageType: m.messageType,
      preview: `${authorLabel}: ${preview(m.messageType, m.message)}`,
      createdAt: m.createdAt,
    };

    sortGroups();
    renderConversations();
  }

  function upsertGroup(groupData) {
    if (!groupData || !groupData.id) {
      return;
    }

    let group = state.groups.find((item) => item.id === groupData.id);
    if (!group) {
      group = {
        id: groupData.id,
        name: groupData.name || `Group ${groupData.id}`,
        avatarUrl: norm(groupData.avatarUrl),
        createdAt: groupData.createdAt || new Date().toISOString(),
        members: [],
        lastMessage: null,
      };
      state.groups.push(group);
    }

    if (groupData.name) {
      group.name = groupData.name;
    }
    if (groupData.createdAt) {
      group.createdAt = groupData.createdAt;
    }
    if (Object.prototype.hasOwnProperty.call(groupData, "avatarUrl")) {
      group.avatarUrl = norm(groupData.avatarUrl);
    }
    if (Array.isArray(groupData.members)) {
      group.members = groupData.members.map((member) => {
        const normalizedMember = {
          id: Number(member.id),
          username: member.username || `User ${member.id}`,
          avatarUrl: norm(member.avatarUrl),
          online: Boolean(member.online),
        };
        state.userMap.set(normalizedMember.id, {
          username: normalizedMember.username,
          avatarUrl: normalizedMember.avatarUrl,
          online: normalizedMember.online,
        });
        return normalizedMember;
      });
    }
    if (groupData.lastMessage) {
      group.lastMessage = groupData.lastMessage;
    }

    sortGroups();

    if (isGroupChatSelected() && state.selectedGroupId === group.id) {
      state.selectedUsername = group.name;
      state.selectedAvatarUrl = group.avatarUrl;
      setHeader();
    }

    renderConversations();
  }

  async function sendMessage(body) {
    if (!hasSelectedChat()) {
      setStatus("Choose a conversation first.", true);
      return null;
    }

    try {
      let sent;

      if (isGroupChatSelected()) {
        if (!socket.connected) {
          throw new Error("Realtime connection is required for group messages.");
        }

        sent = await emitAck("send_group_message", {
          groupId: state.selectedGroupId,
          senderId: currentUser.id,
          message: body.message || "",
          messageType: body.messageType || MSG.TEXT,
          mediaUrl: body.mediaUrl || null,
        });

        updateGroupFromMessage(sent);
      } else {
        const payload = {
          senderId: currentUser.id,
          receiverId: state.selectedUserId,
          message: body.message || "",
          messageType: body.messageType || MSG.TEXT,
          mediaUrl: body.mediaUrl || null,
        };

        sent = socket.connected
          ? await emitAck("send_message", payload)
          : (await window.Api.sendMessage(payload)).data;

        updateConvFromMessage(sent);
      }

      upsertMessage(sent, true);
      setStatus("", false);
      return sent;
    } catch (e) {
      setStatus(e.message, true);
      return null;
    }
  }

  async function deleteMessage(id) {
    if (!id || !window.confirm("Delete this message?")) return;
    try {
      const msg = socket.connected
        ? await emitAck("delete_message", { messageId: id, userId: currentUser.id })
        : (await window.Api.deleteMessage(id, currentUser.id)).data;
      updateConvFromMessage(msg);
      if (isOpenConv(msg)) upsertMessage(msg, false);
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  function emitAck(eventName, payload) {
    return new Promise((resolve, reject) => {
      socket.emit(eventName, payload, (ack) => {
        if (ack && ack.ok) resolve(ack.message);
        else reject(new Error((ack && ack.error) || "Operation failed."));
      });
    });
  }

  function getTypingContext() {
    if (isDirectChatSelected()) {
      return {
        key: `${CHAT.DIRECT}:${state.selectedUserId}`,
        kind: CHAT.DIRECT,
        targetId: state.selectedUserId,
      };
    }

    if (isGroupChatSelected()) {
      return {
        key: `${CHAT.GROUP}:${state.selectedGroupId}`,
        kind: CHAT.GROUP,
        targetId: state.selectedGroupId,
      };
    }

    return null;
  }

  function emitTyping() {
    const context = getTypingContext();
    if (!socket.connected || !context || state.typingSentContext === context.key) return;

    stopTyping();

    if (context.kind === CHAT.GROUP) {
      socket.emit("group_typing", { senderId: currentUser.id, groupId: context.targetId });
    } else {
      socket.emit("typing", { senderId: currentUser.id, receiverId: context.targetId });
    }

    state.typingSentContext = context.key;
  }

  function stopTyping() {
    if (!state.typingSentContext) {
      return;
    }

    const [kind, targetIdRaw] = state.typingSentContext.split(":");
    const targetId = Number(targetIdRaw);

    if (socket.connected && targetId) {
      if (kind === CHAT.GROUP) {
        socket.emit("group_stop_typing", { senderId: currentUser.id, groupId: targetId });
      } else {
        socket.emit("stop_typing", { senderId: currentUser.id, receiverId: targetId });
      }
    }

    state.typingSentContext = null;
  }

  function resetTypingTimer() {
    if (state.typingTimer) clearTimeout(state.typingTimer);
    state.typingTimer = setTimeout(() => stopTyping(), TYPING_MS);
  }

  function resizeInput() {
    els.messageInput.style.height = "auto";
    els.messageInput.style.height = `${Math.min(els.messageInput.scrollHeight, 130)}px`;
  }

  function clearInput() {
    els.messageInput.value = "";
    resizeInput();
  }

  async function sendText() {
    const txt = els.messageInput.value;
    if (!txt.trim()) return;
    const sent = await sendMessage({ messageType: MSG.TEXT, message: txt });
    if (sent) {
      clearInput();
      stopTyping();
    }
  }

  function readDataUrl(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error("Failed to read selected image."));
      r.readAsDataURL(file);
    });
  }

  async function sendImage(file) {
    if (!file) return;
    if (file.size > MAX_IMG) {
      setStatus("Image is too large. Please use a file under 2 MB.", true);
      return;
    }
    try {
      setStatus("Uploading image...", false);
      const sent = await sendMessage({
        messageType: MSG.IMAGE,
        mediaUrl: await readDataUrl(file),
        message: els.messageInput.value,
      });
      if (sent) clearInput();
    } catch (e) {
      setStatus(e.message, true);
    } finally {
      els.imageInput.value = "";
    }
  }

  async function updateAvatar(avatarUrl) {
    try {
      const res = await window.Api.updateAvatar(currentUser.id, avatarUrl);
      currentUser.avatarUrl = norm(res.user && res.user.avatarUrl);
      window.AuthStore.saveUser(currentUser);
      renderCurrentUser();
      setStatus("Profile picture updated.", false);
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  async function uploadAvatar(file) {
    if (!file) return;
    if (file.size > MAX_IMG) {
      setStatus("Avatar image is too large. Use a file under 2 MB.", true);
      return;
    }
    try {
      setStatus("Uploading profile picture...", false);
      await updateAvatar(await readDataUrl(file));
    } catch (e) {
      setStatus(e.message, true);
    } finally {
      els.profileAvatarInput.value = "";
    }
  }

  async function updateGroupAvatar(avatarUrl) {
    const selectedGroup = getSelectedGroup();
    if (!selectedGroup) {
      setStatus("Choose a group first.", true);
      return;
    }

    try {
      const response = await window.Api.updateGroupAvatar(selectedGroup.id, currentUser.id, avatarUrl);
      if (response && response.group) {
        upsertGroup(response.group);
      }
      setStatus(avatarUrl ? "Group photo updated." : "Group photo removed.", false);
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  async function uploadGroupAvatar(file) {
    if (!file) {
      return;
    }
    if (file.size > MAX_IMG) {
      setStatus("Group image is too large. Use a file under 2 MB.", true);
      return;
    }

    try {
      setStatus("Uploading group photo...", false);
      await updateGroupAvatar(await readDataUrl(file));
    } catch (e) {
      setStatus(e.message, true);
    } finally {
      els.groupAvatarInput.value = "";
    }
  }

  async function removeGroupFromState(groupId, statusMessage) {
    const normalizedGroupId = Number(groupId);
    if (!normalizedGroupId) {
      return;
    }

    const groupExists = state.groups.some((group) => group.id === normalizedGroupId);
    const wasSelected = isGroupChatSelected() && Number(state.selectedGroupId) === normalizedGroupId;

    if (!groupExists && !wasSelected) {
      return;
    }

    state.groups = state.groups.filter((group) => group.id !== normalizedGroupId);
    state.unreadGroups.delete(normalizedGroupId);
    clearGroupTyping(normalizedGroupId);

    if (wasSelected) {
      state.selectedChatKind = null;
      state.selectedGroupId = null;
      state.selectedUserId = null;
      state.selectedUsername = "";
      state.selectedAvatarUrl = null;
      state.messageNodes.clear();
      els.messagesContainer.innerHTML = "";
      state.mobileChatOpen = false;
      closeGroupCallModal();
      await ensureActiveSelection();
    } else {
      renderConversations();
      setHeader();
    }

    syncMobileLayout();

    if (statusMessage) {
      setStatus(statusMessage, false);
    }
  }

  async function leaveSelectedGroup() {
    const selectedGroup = getSelectedGroup();
    if (!selectedGroup) {
      setStatus("Choose a group first.", true);
      return;
    }

    const confirmed = window.confirm(`Leave "${selectedGroup.name}"?`);
    if (!confirmed) {
      return;
    }

    try {
      if (socket.connected) {
        await emitAck("leave_group", {
          groupId: selectedGroup.id,
          userId: currentUser.id,
        });
      } else {
        await window.Api.leaveGroup(selectedGroup.id, currentUser.id);
      }

      await removeGroupFromState(selectedGroup.id, "You left the group.");
      toggleChatMenu(false);
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  async function saveUsername() {
    const nextUsername = String(els.usernameInput.value || "").trim();
    if (!nextUsername) {
      setStatus("Username is required.", true);
      return;
    }
    if (nextUsername === currentUser.username) {
      setStatus("Username is unchanged.", false);
      return;
    }

    try {
      const res = await window.Api.updateUsername(currentUser.id, nextUsername);
      currentUser.username = String((res.user && res.user.username) || nextUsername);
      currentUser.avatarUrl = norm(res.user && res.user.avatarUrl);
      window.AuthStore.saveUser(currentUser);
      renderCurrentUser();
      setStatus("Username updated.", false);
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  function setGroupModalStatus(message, isError) {
    if (!els.groupModalStatus) {
      return;
    }

    els.groupModalStatus.textContent = message || "";
    els.groupModalStatus.style.color = isError ? "var(--danger)" : "var(--muted)";
  }

  function setGroupCallStatus(message, isError) {
    if (!els.groupCallStatus) {
      return;
    }

    els.groupCallStatus.textContent = message || "";
    els.groupCallStatus.style.color = isError ? "var(--danger)" : "var(--muted)";
  }

  function closeGroupCallModal() {
    if (!els.groupCallModal) {
      return;
    }

    els.groupCallModal.classList.add("hidden");
    els.groupCallMemberOptions.innerHTML = "";
    setGroupCallStatus("", false);
  }

  function renderGroupCallOptions() {
    if (!els.groupCallMemberOptions || !els.groupCallSubtitle) {
      return;
    }

    const selectedGroup = getSelectedGroup();
    const candidates = getCallableGroupMembers();

    els.groupCallMemberOptions.innerHTML = "";
    els.groupCallSubtitle.textContent = selectedGroup
      ? `Choose who to call in ${selectedGroup.name}. Only online members are shown.`
      : "Choose who you want to call.";

    if (!candidates.length) {
      const empty = document.createElement("p");
      empty.className = "status";
      empty.textContent = "Nobody else in this group is online right now.";
      els.groupCallMemberOptions.appendChild(empty);
      return;
    }

    candidates.forEach((candidate) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "group-member-option group-member-option-button";

      const main = document.createElement("div");
      main.className = "group-member-option-main";

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      paintAvatar(avatar, candidate.username, candidate.avatarUrl);

      const meta = document.createElement("div");
      meta.className = "group-member-option-meta";

      const name = document.createElement("p");
      name.className = "group-member-option-name";
      name.textContent = candidate.username;

      const status = document.createElement("p");
      status.className = "group-member-option-status";
      status.textContent = "Online now";

      const action = document.createElement("span");
      action.className = "group-member-option-action";
      action.textContent = "Call";

      meta.append(name, status);
      main.append(avatar, meta);
      button.append(main, action);

      button.addEventListener("click", async () => {
        closeGroupCallModal();
        await startVoiceCall(candidate.id);
      });

      els.groupCallMemberOptions.appendChild(button);
    });
  }

  function getGroupEditorCandidates() {
    const selectedGroup = state.groups.find((group) => group.id === state.groupEditor.groupId);
    const existingMemberIds = new Set((selectedGroup && selectedGroup.members || []).map((member) => member.id));

    return state.conversations
      .filter((conversation) => {
        if (state.groupEditor.mode !== "add") {
          return true;
        }
        return !existingMemberIds.has(conversation.userId);
      })
      .map((conversation) => ({
        id: conversation.userId,
        username: conversation.username,
        avatarUrl: conversation.avatarUrl,
        online: conversation.online,
      }));
  }

  function renderGroupEditorOptions() {
    els.groupMemberOptions.innerHTML = "";
    const candidates = getGroupEditorCandidates();

    if (!candidates.length) {
      const empty = document.createElement("p");
      empty.className = "status";
      empty.textContent =
        state.groupEditor.mode === "add"
          ? "Everyone is already in this group."
          : "No users are available yet.";
      els.groupMemberOptions.appendChild(empty);
      return;
    }

    candidates.forEach((candidate) => {
      const row = document.createElement("label");
      row.className = "group-member-option";

      const main = document.createElement("div");
      main.className = "group-member-option-main";

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      paintAvatar(avatar, candidate.username, candidate.avatarUrl);

      const meta = document.createElement("div");
      meta.className = "group-member-option-meta";

      const name = document.createElement("p");
      name.className = "group-member-option-name";
      name.textContent = candidate.username;

      const status = document.createElement("p");
      status.className = "group-member-option-status";
      status.textContent = candidate.online ? "Online" : "Offline";

      meta.append(name, status);
      main.append(avatar, meta);

      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.checked = state.groupEditor.selectedUserIds.has(candidate.id);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) {
          state.groupEditor.selectedUserIds.add(candidate.id);
        } else {
          state.groupEditor.selectedUserIds.delete(candidate.id);
        }
      });

      row.append(main, checkbox);
      els.groupMemberOptions.appendChild(row);
    });
  }

  function openGroupEditor(mode, groupId) {
    state.groupEditor.mode = mode === "add" ? "add" : "create";
    state.groupEditor.groupId = groupId || null;
    state.groupEditor.selectedUserIds = new Set();

    const isAddMode = state.groupEditor.mode === "add";
    els.groupModalTitle.textContent = isAddMode ? "Add Members" : "Create Group";
    els.groupModalSubtitle.textContent = isAddMode
      ? "Invite more people to this conversation."
      : "Choose members for your new conversation.";
    els.groupModalHint.textContent = isAddMode
      ? "Select people who are not already in the group."
      : "Select at least one person to get started.";
    els.saveGroupBtn.textContent = isAddMode ? "Add Members" : "Create Group";
    els.groupNameField.classList.toggle("hidden", isAddMode);

    if (!isAddMode) {
      els.groupNameInput.value = "";
    }

    setGroupModalStatus("", false);
    renderGroupEditorOptions();
    els.groupModal.classList.remove("hidden");

    if (isAddMode) {
      els.groupMemberOptions.focus();
    } else {
      els.groupNameInput.focus();
    }
  }

  function closeGroupEditor() {
    state.groupEditor.mode = "create";
    state.groupEditor.groupId = null;
    state.groupEditor.selectedUserIds = new Set();
    els.groupNameInput.value = "";
    setGroupModalStatus("", false);
    els.groupModal.classList.add("hidden");
  }

  async function saveGroupEditor() {
    const memberIds = Array.from(state.groupEditor.selectedUserIds);
    if (!memberIds.length) {
      setGroupModalStatus("Choose at least one member.", true);
      return;
    }

    try {
      if (state.groupEditor.mode === "add") {
        let latestResponse = null;
        for (const memberId of memberIds) {
          latestResponse = await window.Api.addUserToGroup(
            state.groupEditor.groupId,
            currentUser.id,
            memberId
          );
        }
        if (latestResponse && latestResponse.group) {
          upsertGroup(latestResponse.group);
        }
        closeGroupEditor();
        setStatus(memberIds.length > 1 ? "Members added to group." : "Member added to group.", false);
        return;
      }

      const groupName = String(els.groupNameInput.value || "").trim();
      if (!groupName) {
        setGroupModalStatus("Group name is required.", true);
        return;
      }

      const response = await window.Api.createGroup(currentUser.id, groupName, memberIds);
      if (response.group) {
        upsertGroup(response.group);
        closeGroupEditor();
        await selectGroup(response.group.id);
      } else {
        closeGroupEditor();
        await refreshChatLists();
      }
      setStatus("Group created.", false);
    } catch (e) {
      setGroupModalStatus(e.message, true);
    }
  }

  function mergeWebRtcConfig(config) {
    if (!config || typeof config !== "object") {
      return rtcConfig;
    }

    const nextConfig = { ...rtcConfig };

    if (Array.isArray(config.iceServers) && config.iceServers.length > 0) {
      nextConfig.iceServers = config.iceServers;
    }

    if (config.iceTransportPolicy === "relay" || config.iceTransportPolicy === "all") {
      nextConfig.iceTransportPolicy = config.iceTransportPolicy;
    }

    const poolSize = Number(config.iceCandidatePoolSize);
    if (Number.isInteger(poolSize) && poolSize >= 0) {
      nextConfig.iceCandidatePoolSize = Math.min(poolSize, 16);
    }

    rtcConfig = nextConfig;
    return rtcConfig;
  }

  async function fetchWebRtcConfigForCall() {
    try {
      const config = await window.Api.fetchWebrtcConfig();
      return mergeWebRtcConfig(config);
    } catch (_error) {
      // Keep local STUN/TURN fallback if backend config fetch fails.
      return rtcConfig;
    }
  }

  async function loadWebRtcConfig() {
    try {
      await fetchWebRtcConfigForCall();
    } catch (_error) {
      // Keep local STUN/TURN fallback if backend config fetch fails.
    }
  }

  function renderGifs(gifs) {
    els.gifResults.innerHTML = "";
    if (!gifs || !gifs.length) {
      const p = document.createElement("p");
      p.className = "status";
      p.textContent = "No GIFs found.";
      els.gifResults.appendChild(p);
      return;
    }
    gifs.forEach((gif) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "gif-card";
      b.title = gif.title || "GIF";
      const img = document.createElement("img");
      img.src = gif.previewUrl || gif.mediaUrl;
      img.alt = gif.title || "GIF";
      img.loading = "lazy";
      b.appendChild(img);
      b.addEventListener("click", async () => {
        const sent = await sendMessage({
          messageType: MSG.GIF,
          mediaUrl: gif.mediaUrl,
          message: els.messageInput.value,
        });
        if (sent) {
          clearInput();
          toggleGif(false);
        }
      });
      els.gifResults.appendChild(b);
    });
  }

  async function searchGifs(q) {
    if (!q.trim()) {
      renderGifs([]);
      return;
    }
    try {
      renderGifs((await window.Api.searchGifs(q, 18)).gifs || []);
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  function toggleGif(show) {
    const open = typeof show === "boolean" ? show : els.gifPicker.classList.contains("hidden");
    els.gifPicker.classList.toggle("hidden", !open);
    if (!open) return;
    els.emojiPanel.classList.add("hidden");
    els.gifSearchInput.focus();
    if (!els.gifResults.children.length) {
      els.gifSearchInput.value = GIF_DEFAULT;
      searchGifs(GIF_DEFAULT);
    }
  }

  function buildEmojiPanel() {
    els.emojiPanel.innerHTML = "";
    EMOJIS.forEach((e) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "emoji-btn";
      b.textContent = e;
      b.addEventListener("click", () => {
        els.messageInput.value += e;
        resizeInput();
        els.messageInput.focus();
      });
      els.emojiPanel.appendChild(b);
    });
  }

  function toggleEmoji() {
    const open = els.emojiPanel.classList.contains("hidden");
    els.emojiPanel.classList.toggle("hidden", !open);
    if (open) els.gifPicker.classList.add("hidden");
  }

  function updateVideoElement(videoEl, fallbackEl, stream, requiresVideo) {
    if (!videoEl || !fallbackEl) {
      return;
    }

    const activeVideoTracks = stream
      ? stream.getVideoTracks().filter((track) => track.readyState === "live")
      : [];
    const hasMedia = stream && (!requiresVideo || activeVideoTracks.length > 0);
    if (!hasMedia) {
      videoEl.srcObject = null;
      videoEl.classList.add("hidden");
      fallbackEl.classList.remove("hidden");
      return;
    }

    videoEl.srcObject = stream;
    videoEl.classList.remove("hidden");
    fallbackEl.classList.add("hidden");
    const playPromise = typeof videoEl.play === "function" ? videoEl.play() : null;
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }

  function setCallControlLabel(button, label) {
    if (!button) {
      return;
    }

    button.setAttribute("title", label);
    button.setAttribute("aria-label", label);
    const textNode = button.querySelector("[data-btn-label]");
    if (textNode) {
      textNode.textContent = label;
    }
  }

  function setCallControlIcon(button, markup) {
    if (!button || !markup) {
      return;
    }

    const iconNode = button.querySelector("[data-call-icon]");
    if (iconNode) {
      iconNode.innerHTML = markup;
    }
  }

  function syncLocalVideoPreview() {
    const previewStream = state.call.screenSharing ? state.call.screenStream : null;
    els.localVideoLabel.textContent = "Your Screen";
    els.localVideoFallback.textContent = "Share your screen to present it in the call.";
    updateVideoElement(els.localVideo, els.localVideoFallback, previewStream, true);
    syncCallDockLayout();
  }

  function syncRemoteMediaPreview() {
    updateVideoElement(els.remoteVideo, els.remoteVideoFallback, state.call.remoteStream, true);
    if (els.remoteAudio) {
      els.remoteAudio.srcObject = state.call.remoteStream || null;
    }
    syncCallDockLayout();
  }

  function hasLiveVideo(stream) {
    return Boolean(
      stream &&
        stream.getVideoTracks().some((track) => track && track.readyState === "live")
    );
  }

  function isCallFullscreenActive() {
    return Boolean(
      document.fullscreenElement &&
        els.callDock &&
        els.callDock.contains(document.fullscreenElement)
    );
  }

  function syncFullscreenButton() {
    if (!els.fullscreenCallBtn) {
      return;
    }
    els.fullscreenCallBtn.textContent = isCallFullscreenActive() ? "Exit Full Screen" : "Full Screen";
  }

  function callHasExpandedMedia() {
    return Boolean(state.call.screenSharing || hasLiveVideo(state.call.remoteStream));
  }

  function syncCallControlButtons() {
    setCallControlLabel(
      els.shareScreenBtn,
      state.call.screenSharing ? "Stop Sharing" : "Share Screen"
    );
    setCallControlLabel(
      els.toggleCallViewBtn,
      state.call.mediaCollapsed ? "Show Preview" : "Hide Preview"
    );
    setCallControlLabel(els.muteCallBtn, state.call.muted ? "Unmute" : "Mute");
    setCallControlIcon(
      els.toggleCallViewBtn,
      state.call.mediaCollapsed ? CALL_ICONS.previewShown : CALL_ICONS.previewHidden
    );
    setCallControlIcon(els.muteCallBtn, state.call.muted ? CALL_ICONS.micOff : CALL_ICONS.micOn);
    els.shareScreenBtn.classList.toggle("is-active", Boolean(state.call.screenSharing));
    els.muteCallBtn.classList.toggle("is-muted", Boolean(state.call.muted));
  }

  function syncCallDockLayout() {
    if (!els.callDock) {
      return;
    }

    const hasLocalScreen = Boolean(state.call.screenSharing && hasLiveVideo(state.call.screenStream));
    const hasRemoteVideo = hasLiveVideo(state.call.remoteStream);
    const showMedia = !state.call.mediaCollapsed && (hasLocalScreen || hasRemoteVideo);

    els.callDock.classList.toggle("call-dock-collapsed", Boolean(state.call.mediaCollapsed));
    els.callDock.classList.toggle("call-dock-sharing", Boolean(state.call.screenSharing));
    els.callDock.classList.toggle("call-dock-media-visible", showMedia);
    els.callDock.classList.toggle("call-dock-single-panel", hasLocalScreen !== hasRemoteVideo);
    els.localVideoPanel.classList.toggle("panel-hidden", !hasLocalScreen);
    els.remoteVideoPanel.classList.toggle("panel-hidden", !hasRemoteVideo);

    syncCallControlButtons();
    syncFullscreenButton();
  }

  function getPreferredFullscreenPanel() {
    if (hasLiveVideo(state.call.screenStream) && els.localVideoPanel) {
      return els.localVideoPanel;
    }
    if (hasLiveVideo(state.call.remoteStream) && els.remoteVideoPanel) {
      return els.remoteVideoPanel;
    }
    return els.callDockMedia || els.callDock;
  }

  async function toggleCallMediaVisibility() {
    if (!state.call.callId) {
      return;
    }

    state.call.mediaCollapsed = !state.call.mediaCollapsed;
    syncCallDockLayout();
  }

  async function toggleCallFullscreen(targetElement) {
    if (!state.call.callId) {
      return;
    }

    const fullscreenTarget = targetElement || getPreferredFullscreenPanel();
    if (!fullscreenTarget || typeof fullscreenTarget.requestFullscreen !== "function") {
      setStatus("Fullscreen is not supported in this browser.", true);
      return;
    }

    try {
      if (state.call.mediaCollapsed) {
        state.call.mediaCollapsed = false;
        syncCallDockLayout();
      }

      if (document.fullscreenElement === fullscreenTarget) {
        if (typeof document.exitFullscreen === "function") {
          await document.exitFullscreen();
        }
        return;
      }

      if (document.fullscreenElement && typeof document.exitFullscreen === "function") {
        await document.exitFullscreen();
      }

      await fullscreenTarget.requestFullscreen();
    } catch (_error) {
      setStatus("Unable to toggle fullscreen mode.", true);
    } finally {
      syncFullscreenButton();
    }
  }

  function resetCallUi() {
    els.callDock.classList.add("hidden");
    els.callLabel.textContent = "Call";
    els.callSubLabel.textContent = "";
    els.muteCallBtn.disabled = true;
    els.shareScreenBtn.disabled = true;
    els.toggleCallViewBtn.disabled = true;
    els.fullscreenCallBtn.disabled = true;
    els.endCallBtn.disabled = true;
    els.incomingCallModal.classList.add("hidden");
    state.call.mediaCollapsed = false;
    syncLocalVideoPreview();
    syncRemoteMediaPreview();
    syncCallDockLayout();
    updateCallButtonState();
  }

  function setCallUi(peerUserId, title, subtitle, isActive) {
    const profile = getUserProfile(peerUserId) || getSelectedConversation() || {};
    paintAvatar(
      els.callAvatar,
      profile.username || state.selectedUsername || `User ${peerUserId}`,
      profile.avatarUrl || null
    );
    els.callLabel.textContent = title;
    els.callSubLabel.textContent = subtitle || "";
    els.callDock.classList.remove("hidden");
    els.muteCallBtn.disabled = !isActive;
    els.shareScreenBtn.disabled = !state.call.callId;
    els.toggleCallViewBtn.disabled = !callHasExpandedMedia();
    els.fullscreenCallBtn.disabled = !callHasExpandedMedia();
    els.endCallBtn.disabled = false;
    state.call.mediaCollapsed = false;
    syncLocalVideoPreview();
    syncRemoteMediaPreview();
    syncCallDockLayout();
    updateCallButtonState();
  }

  function setCallStatus(status, subtitle) {
    state.call.status = status;
    if (subtitle !== undefined) {
      els.callSubLabel.textContent = subtitle;
    }
    if (status === CALL.ACTIVE) {
      els.muteCallBtn.disabled = false;
    }
    if (state.call.callId) {
      els.shareScreenBtn.disabled = false;
    }
    els.toggleCallViewBtn.disabled = !callHasExpandedMedia();
    els.fullscreenCallBtn.disabled = !callHasExpandedMedia();
    syncCallDockLayout();
  }

  function clearCallMedia() {
    if (isCallFullscreenActive() && typeof document.exitFullscreen === "function") {
      const exitPromise = document.exitFullscreen();
      if (exitPromise && typeof exitPromise.catch === "function") {
        exitPromise.catch(() => {});
      }
    }
    if (state.call.peerConnection) {
      state.call.peerConnection.ontrack = null;
      state.call.peerConnection.onicecandidate = null;
      state.call.peerConnection.onconnectionstatechange = null;
      state.call.peerConnection.oniceconnectionstatechange = null;
      state.call.peerConnection.onicegatheringstatechange = null;
      state.call.peerConnection.onicecandidateerror = null;
      state.call.peerConnection.close();
      state.call.peerConnection = null;
    }
    if (state.call.localStream) {
      state.call.localStream.getTracks().forEach((track) => track.stop());
      state.call.localStream = null;
    }
    if (state.call.screenStream) {
      state.call.screenStream.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      state.call.screenStream = null;
    }
    state.call.screenSharing = false;
    state.call.mediaCollapsed = false;
    state.call.videoSender = null;
    state.call.remoteStream = null;
    if (els.remoteAudio) {
      els.remoteAudio.srcObject = null;
    }
    if (els.remoteVideo) {
      els.remoteVideo.srcObject = null;
    }
    if (els.localVideo) {
      els.localVideo.srcObject = null;
    }
    syncLocalVideoPreview();
    syncRemoteMediaPreview();
    syncCallDockLayout();
  }

  async function ensureLocalMediaStream() {
    if (state.call.localStream) {
      return state.call.localStream;
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });

    stream.getAudioTracks().forEach((track) => {
      track.enabled = !state.call.muted;
    });
    state.call.localStream = stream;
    syncLocalVideoPreview();
    return stream;
  }

  async function createPeerConnection(peerUserId, callId) {
    const liveRtcConfig = await fetchWebRtcConfigForCall();
    const pc = new RTCPeerConnection({
      ...liveRtcConfig,
      iceServers: liveRtcConfig.iceServers,
    });
    const videoTransceiver = pc.addTransceiver("video", {
      direction: "sendrecv",
    });
    state.call.videoSender = videoTransceiver.sender;

    pc.ontrack = (event) => {
      console.log("RECEIVED TRACK");

      event.track.onmute = () => {
        syncRemoteMediaPreview();
      };
      event.track.onunmute = () => {
        syncRemoteMediaPreview();
      };
      event.track.onended = () => {
        syncRemoteMediaPreview();
      };

      if (!state.call.remoteStream) {
        state.call.remoteStream = new MediaStream();
      }

      const hasTrack = state.call.remoteStream
        .getTracks()
        .some((track) => track.id === event.track.id);
      if (!hasTrack) {
        state.call.remoteStream.addTrack(event.track);
      }

      syncRemoteMediaPreview();
    };

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;

      if (typeof event.candidate.candidate === "string") {
        state.call.hasRelayCandidate =
          state.call.hasRelayCandidate || event.candidate.candidate.includes(" typ relay ");
      }

      console.log("SENDING ICE:", event.candidate);

      socket.emit("ice-candidate", {
        callId,
        fromUserId: currentUser.id,
        toUserId: peerUserId,
        to: peerUserId,
        candidate: event.candidate,
      });
    };

    pc.onconnectionstatechange = () => {
      console.log("STATE:", pc.connectionState);

      if (state.call.callId !== callId) return;

      if (pc.connectionState === "connected") {
        console.log("CONNECTED:", pc.connectionState);
        setCallStatus(CALL.ACTIVE, "Connected");
        return;
      }

      if (pc.connectionState === "disconnected") {
        setCallStatus(CALL.CONNECTING, "Reconnecting...");
        return;
      }

      if (pc.connectionState === "failed" || pc.connectionState === "closed") {
        finishCall(false, "Call connection failed.");
      }
    };

    pc.oniceconnectionstatechange = () => {
      console.log("ICE STATE:", pc.iceConnectionState);

      if (state.call.callId !== callId) return;

      if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
        setCallStatus(CALL.ACTIVE, "Connected");
        return;
      }

      if (pc.iceConnectionState === "disconnected") {
        setCallStatus(CALL.CONNECTING, "Reconnecting...");
        return;
      }

      if (pc.iceConnectionState === "failed") {
        finishCall(false, "Network path failed. Try again or use TURN relay.");
      }
    };

    pc.onicegatheringstatechange = () => {
      if (state.call.callId !== callId) return;
      if (pc.iceGatheringState !== "complete") return;

      if (liveRtcConfig.iceTransportPolicy === "relay" && !state.call.hasRelayCandidate) {
        console.warn("No relay ICE candidate gathered. TURN may be blocked or misconfigured.");
      }
    };

    pc.onicecandidateerror = (event) => {
      const url = String((event && event.url) || "");
      const errorCode = Number((event && event.errorCode) || 0);
      const errorText = String((event && event.errorText) || "");
      const isConnectivityProbeFailure = errorCode === 701;

      if (isConnectivityProbeFailure) {
        return;
      }

      console.warn("ICE candidate error", { url, errorCode, errorText });
    };

    state.call.peerConnection = pc;
    return pc;
  }

  async function attachLocalMediaTracks(pc) {
    const stream = await ensureLocalMediaStream();
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !state.call.muted;
      pc.addTrack(track, stream);
    });
    if (state.call.videoSender) {
      await state.call.videoSender.replaceTrack(null);
    }
    syncLocalVideoPreview();
  }

  async function stopScreenShare() {
    if (!state.call.videoSender) {
      throw new Error("Screen sharing is not ready yet.");
    }

    await state.call.videoSender.replaceTrack(null);

    if (state.call.screenStream) {
      state.call.screenStream.getTracks().forEach((track) => {
        track.onended = null;
        track.stop();
      });
      state.call.screenStream = null;
    }

    state.call.screenSharing = false;
    syncLocalVideoPreview();
    updateCallButtonState();
  }

  async function toggleScreenShare() {
    if (!state.call.callId || !state.call.videoSender) {
      setStatus("Call video is not ready yet.", true);
      return;
    }

    try {
      if (state.call.screenSharing) {
        await stopScreenShare();
        setStatus("Screen sharing stopped.", false);
        return;
      }

      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const [screenTrack] = displayStream.getVideoTracks();

      if (!screenTrack) {
        throw new Error("No screen track is available.");
      }

      screenTrack.onended = () => {
        if (state.call.screenSharing) {
          stopScreenShare()
            .then(() => {
              setStatus("Screen sharing stopped.", false);
            })
            .catch((error) => {
              setStatus(error.message || "Screen sharing stopped.", false);
            });
        }
      };

      state.call.screenStream = displayStream;
      state.call.screenSharing = true;
      await state.call.videoSender.replaceTrack(screenTrack);
      syncLocalVideoPreview();
      updateCallButtonState();
      setStatus("Screen sharing started.", false);
    } catch (error) {
      if (error && error.name === "NotAllowedError") {
        setStatus("Screen sharing was cancelled.", true);
        return;
      }
      setStatus((error && error.message) || "Unable to share your screen.", true);
    }
  }

  function resetRemoteIceState(clearQueue) {
    if (clearQueue) {
      state.call.pendingRemoteCandidates = [];
    }
  }

  function queueRemoteCandidate(candidate) {
    if (!candidate) {
      return;
    }
    state.call.pendingRemoteCandidates.push(candidate);
  }

  async function flushQueuedRemoteCandidates() {
    const pc = state.call.peerConnection;
    if (!pc || !pc.remoteDescription || !pc.remoteDescription.type) {
      return;
    }

    if (!state.call.pendingRemoteCandidates.length) {
      return;
    }

    const queued = state.call.pendingRemoteCandidates.splice(0);
    for (const candidate of queued) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        console.error("Error adding queued ICE:", error);
      }
    }
  }

  function getSignalFromUserId(payload) {
    return Number(payload && (payload.fromUserId ?? payload.from));
  }

  function getSignalCallId(payload) {
    return norm(payload && payload.callId);
  }

  function activeCallMatches(payload) {
    return (
      payload &&
      state.call.callId &&
      getSignalCallId(payload) === state.call.callId &&
      getSignalFromUserId(payload) === Number(state.call.peerUserId)
    );
  }

  async function startCallFromCurrentChat() {
    if (state.call.callId || state.call.pendingIncoming) {
      setStatus("A call is already in progress.", true);
      return;
    }

    if (isGroupChatSelected()) {
      const callableMembers = getCallableGroupMembers();
      if (!callableMembers.length) {
        setStatus("Nobody else in this group is online right now.", true);
        return;
      }

      if (callableMembers.length === 1) {
        closeGroupCallModal();
        await startVoiceCall(callableMembers[0].id);
        return;
      }

      renderGroupCallOptions();
      setGroupCallStatus("", false);
      els.groupCallModal.classList.remove("hidden");
      return;
    }

    await startVoiceCall();
  }

  async function startVoiceCall(targetUserId = null) {
    const selected = targetUserId ? getUserProfile(targetUserId) : getSelectedConversation();
    if (!socket.connected) {
      setStatus("Realtime connection is offline. Please reconnect and try again.", true);
      return;
    }
    if (!selected || !selected.online) {
      setStatus("The selected user is offline.", true);
      return;
    }
    if (state.call.callId || state.call.pendingIncoming) {
      setStatus("A call is already in progress.", true);
      return;
    }

    const callId = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    try {
      state.call.callId = callId;
      state.call.peerUserId = selected.userId;
      state.call.muted = false;
      state.call.screenSharing = false;
      state.call.hasRelayCandidate = false;
      resetRemoteIceState(true);

      setCallUi(selected.userId, `Calling ${selected.username}`, "Ringing...", false);

      const pc = await createPeerConnection(selected.userId, callId);
      await attachLocalMediaTracks(pc);

      const offer = await pc.createOffer();
      console.log("OFFER CREATED");
      await pc.setLocalDescription(offer);

      await emitAck("call_offer", {
        callId,
        fromUserId: currentUser.id,
        toUserId: selected.userId,
        offer,
      });

      setCallStatus(CALL.DIALING, "Waiting for answer...");
      setStatus("", false);
    } catch (e) {
      finishCall(false);
      setStatus(e.message || "Unable to start call.", true);
    }
  }

  async function acceptIncomingCall() {
    const pending = state.call.pendingIncoming;
    if (!pending) {
      return;
    }

    state.call.pendingIncoming = null;
    els.incomingCallModal.classList.add("hidden");

    try {
      const profile = state.userMap.get(pending.fromUserId) || {};
      state.call.callId = pending.callId;
      state.call.peerUserId = pending.fromUserId;
      state.call.muted = false;
      state.call.screenSharing = false;
      state.call.hasRelayCandidate = false;
      resetRemoteIceState(false);

      setCallUi(
        pending.fromUserId,
        `Call with ${profile.username || `User ${pending.fromUserId}`}`,
        "Connecting...",
        false
      );

      const pc = await createPeerConnection(pending.fromUserId, pending.callId);
      await attachLocalMediaTracks(pc);
      await pc.setRemoteDescription(new RTCSessionDescription(pending.offer));
      await flushQueuedRemoteCandidates();

      const answer = await pc.createAnswer();
      console.log("ANSWER CREATED");
      await pc.setLocalDescription(answer);

      await emitAck("call_answer", {
        callId: pending.callId,
        fromUserId: currentUser.id,
        toUserId: pending.fromUserId,
        answer,
      });

      setCallStatus(CALL.CONNECTING, "Connecting...");
      setStatus("", false);
    } catch (e) {
      finishCall(false);
      setStatus(e.message || "Unable to answer call.", true);
    }
  }

  function rejectIncomingCall() {
    const pending = state.call.pendingIncoming;
    if (!pending) {
      return;
    }
    socket.emit("call_reject", {
      callId: pending.callId,
      fromUserId: currentUser.id,
      toUserId: pending.fromUserId,
    });
    state.call.pendingIncoming = null;
    els.incomingCallModal.classList.add("hidden");
    updateCallButtonState();
  }

  function finishCall(notifyPeer, message) {
    const peerUserId = state.call.peerUserId;
    const callId = state.call.callId;

    clearCallMedia();

    state.call.status = CALL.IDLE;
    state.call.callId = null;
    state.call.peerUserId = null;
    state.call.muted = false;
    state.call.screenSharing = false;
    state.call.hasRelayCandidate = false;
    state.call.pendingIncoming = null;
    resetRemoteIceState(true);

    if (notifyPeer && peerUserId && callId) {
      socket.emit("call_end", {
        callId,
        fromUserId: currentUser.id,
        toUserId: peerUserId,
      });
    }

    resetCallUi();

    if (message) {
      setStatus(message, false);
    }
  }

  function toggleMuteCall() {
    if (!state.call.localStream) {
      return;
    }

    state.call.muted = !state.call.muted;
    state.call.localStream.getAudioTracks().forEach((track) => {
      track.enabled = !state.call.muted;
    });
    syncCallControlButtons();
  }

  function handleIncomingCall(payload) {
    const callId = getSignalCallId(payload);
    const fromUserId = getSignalFromUserId(payload);
    const offer = payload && payload.offer;

    if (!callId || !fromUserId || !offer) {
      return;
    }

    if (state.call.callId || state.call.pendingIncoming) {
      socket.emit("call_reject", {
        callId,
        fromUserId: currentUser.id,
        toUserId: fromUserId,
      });
      return;
    }

    state.call.pendingIncoming = { callId, fromUserId, offer };
    closeGroupCallModal();
    resetRemoteIceState(true);
    const profile = state.userMap.get(fromUserId) || {};
    els.incomingCallLabel.textContent = `${profile.username || `User ${fromUserId}`} is calling you.`;
    els.incomingCallModal.classList.remove("hidden");
    updateCallButtonState();
  }

  async function handleCallAnswer(payload) {
    if (!activeCallMatches(payload) || !state.call.peerConnection) {
      return;
    }
    try {
      await state.call.peerConnection.setRemoteDescription(
        new RTCSessionDescription(payload.answer)
      );
      await flushQueuedRemoteCandidates();
      setCallStatus(CALL.CONNECTING, "Connecting...");
    } catch (_error) {
      finishCall(false, "Call failed to connect.");
    }
  }

  async function handleCallIceCandidate(payload) {
    const callId = getSignalCallId(payload);
    const fromUserId = getSignalFromUserId(payload);
    const candidateData = payload && payload.candidate;

    if (!callId || !fromUserId || !candidateData) {
      return;
    }

    console.log("RECEIVED ICE:", candidateData);

    let candidate;
    try {
      candidate = new RTCIceCandidate(candidateData);
    } catch (error) {
      console.error("ICE error:", error);
      return;
    }

    const pending = state.call.pendingIncoming;
    const isEarlyIncomingCandidate =
      pending &&
      !state.call.callId &&
      callId === pending.callId &&
      fromUserId === Number(pending.fromUserId);

    if (isEarlyIncomingCandidate) {
      console.log("Queueing ICE...");
      queueRemoteCandidate(candidate);
      return;
    }

    if (!activeCallMatches(payload)) {
      return;
    }

    if (!state.call.peerConnection) {
      console.warn("PeerConnection not ready yet");
      console.log("Queueing ICE...");
      queueRemoteCandidate(candidate);
      return;
    }

    if (
      !state.call.peerConnection.remoteDescription ||
      !state.call.peerConnection.remoteDescription.type
    ) {
      console.log("Queueing ICE...");
      queueRemoteCandidate(candidate);
      return;
    }

    try {
      await state.call.peerConnection.addIceCandidate(candidate);
    } catch (error) {
      console.error("ICE error:", error);
    }
  }

  function syncUserProfile(uid, data) {
    if (!uid || !data) {
      return;
    }

    const current = state.userMap.get(uid) || {};
    if (data.username) {
      current.username = data.username;
    }
    if (Object.prototype.hasOwnProperty.call(data, "avatarUrl")) {
      current.avatarUrl = norm(data.avatarUrl);
    }
    if (Object.prototype.hasOwnProperty.call(data, "online")) {
      current.online = Boolean(data.online);
    }
    state.userMap.set(uid, current);

    const c = state.conversations.find((x) => x.userId === uid);
    if (c) {
      if (data.username) c.username = data.username;
      if (Object.prototype.hasOwnProperty.call(data, "avatarUrl")) c.avatarUrl = norm(data.avatarUrl);
      if (Object.prototype.hasOwnProperty.call(data, "online")) c.online = Boolean(data.online);
    }

    state.groups.forEach((group) => {
      const member = (group.members || []).find((item) => item.id === uid);
      if (!member) {
        return;
      }

      if (data.username) member.username = data.username;
      if (Object.prototype.hasOwnProperty.call(data, "avatarUrl")) {
        member.avatarUrl = norm(data.avatarUrl);
      }
      if (Object.prototype.hasOwnProperty.call(data, "online")) {
        member.online = Boolean(data.online);
      }
    });

    if (state.selectedUserId === uid) {
      if (data.username) state.selectedUsername = data.username;
      if (Object.prototype.hasOwnProperty.call(data, "avatarUrl")) {
        state.selectedAvatarUrl = norm(data.avatarUrl);
      }
      if (!els.groupCallModal.classList.contains("hidden")) {
        renderGroupCallOptions();
      }
      setHeader();
      return;
    }

    if (!els.groupCallModal.classList.contains("hidden")) {
      renderGroupCallOptions();
    }

    if (isGroupChatSelected()) {
      setHeader();
    }
  }

  function bindSocket() {
    socket.on("connect", () => {
      socket.emit("register", { userId: currentUser.id });
    });
    socket.on("disconnect", () => {
      state.typingSentContext = null;
      state.typingUsers.clear();
      state.typingGroups.clear();
      if (state.call.callId) {
        finishCall(false, "Connection lost. Call ended.");
      }
      setHeader();
      renderConversations();
    });
    socket.on("receive_message", (m) => {
      if (!m || !m.id) return;
      updateConvFromMessage(m);
      if (isOpenConv(m)) {
        upsertMessage(m, false);
        if (m.senderId === state.selectedUserId) {
          state.typingUsers.delete(state.selectedUserId);
          setHeader();
        }
      } else if (m.senderId !== currentUser.id) {
        state.unread.add(m.senderId);
        renderConversations();
      }
    });
    socket.on("receive_group_message", (m) => {
      if (!m || !m.id) return;
      updateGroupFromMessage(m);
      if (isOpenGroupMessage(m)) {
        upsertMessage(m, false);
        clearGroupTyping(m.groupId, m.senderId);
        setHeader();
      } else if (m.senderId !== currentUser.id) {
        state.unreadGroups.add(m.groupId);
        renderConversations();
      }
    });
    socket.on("message_deleted", (m) => {
      if (!m || !m.id) return;
      updateConvFromMessage(m);
      if (isOpenConv(m)) upsertMessage(m, false);
    });
    socket.on("message_status", (p) => {
      if (p && p.messageId) updateStatus(p.messageId, p.status || "delivered");
    });
    socket.on("typing", (p) => {
      const sid = Number(p && p.senderId);
      if (!sid || sid === currentUser.id) return;
      state.typingUsers.add(sid);
      setHeader();
      renderConversations();
    });
    socket.on("group_typing", (p) => {
      const sid = Number(p && p.senderId);
      const groupId = Number(p && p.groupId);
      if (!sid || !groupId || sid === currentUser.id) return;
      getGroupTypingSet(groupId).add(sid);
      setHeader();
      renderConversations();
    });
    socket.on("stop_typing", (p) => {
      const sid = Number(p && p.senderId);
      if (!sid) return;
      state.typingUsers.delete(sid);
      setHeader();
      renderConversations();
    });
    socket.on("group_stop_typing", (p) => {
      const sid = Number(p && p.senderId);
      const groupId = Number(p && p.groupId);
      if (!groupId) return;
      clearGroupTyping(groupId, sid || null);
      setHeader();
      renderConversations();
    });
    socket.on("presence_update", (p) => {
      const uid = Number(p && p.userId);
      if (!uid) return;
      const online = Boolean(p && p.online);

      syncUserProfile(uid, { online });
      if (state.call.callId && state.call.peerUserId === uid && !online) {
        finishCall(false, "Peer went offline. Call ended.");
      }
      setHeader();
      renderConversations();
    });
    socket.on("user_profile_updated", (p) => {
      const uid = Number(p && p.userId);
      if (!uid) return;
      const av = norm(p.avatarUrl);
      const username = norm(p.username);
      if (uid === currentUser.id) {
        if (username) {
          currentUser.username = username;
        }
        currentUser.avatarUrl = av;
        window.AuthStore.saveUser(currentUser);
        renderCurrentUser();
      }
      syncUserProfile(uid, { username, avatarUrl: av });
      renderConversations();
    });
    socket.on("group_updated", (group) => {
      upsertGroup(group);
      if (!group || !group.id) {
        return;
      }

      if (isGroupChatSelected() && state.selectedGroupId === group.id) {
        setHeader();
      }
    });
    socket.on("group_left", async (payload) => {
      const groupId = Number(payload && payload.groupId);
      const userId = Number(payload && payload.userId);
      if (!groupId || userId !== currentUser.id) {
        return;
      }

      await removeGroupFromState(groupId, "You left the group.");
    });
    socket.on("direct_invites_updated", async (payload) => {
      try {
        const invite = payload && payload.invite;
        const action = payload && payload.action;
        const isReceiver = invite && Number(invite.receiverId) === currentUser.id;

        if (action === "sent" && isReceiver) {
          showAnnouncement("You received a new friend request.");
        } else if (action === "accepted" && invite) {
          showAnnouncement("Friend request accepted. You can chat and call now.");
        }

        await refreshChatLists();
      } catch (error) {
        setStatus(error.message || "Failed to refresh invites.", true);
      }
    });

    socket.on("incoming-call", handleIncomingCall);
    socket.on("call-answered", handleCallAnswer);
    socket.on("ice-candidate", handleCallIceCandidate);
    socket.on("call_reject", (p) => {
      if (!activeCallMatches(p)) return;
      finishCall(false, "Call was declined.");
    });
    socket.on("call_end", (p) => {
      if (!activeCallMatches(p)) return;
      finishCall(false, "Call ended.");
    });
  }

  function bindUi() {
    els.navChatsBtn.addEventListener("click", () => {
      setSettings(false);
      if (isMobileViewport()) {
        showMobileConversationList();
      } else {
        els.messageInput.focus();
      }
    });
    els.navProfileBtn.addEventListener("click", () => setSettings(true));
    els.navSettingsBtn.addEventListener("click", () => setSettings(true));
    els.closeSettingsBtn.addEventListener("click", () => setSettings(false));
    els.mobileBackBtn.addEventListener("click", () => {
      showMobileConversationList();
    });
    els.themeToggleBtn.addEventListener("click", () => {
      const next = document.body.classList.contains("theme-dark") ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
    els.refreshUsersBtn.addEventListener("click", () => refreshChatLists());
    els.inviteBtn.addEventListener("click", async () => {
      await openInviteModal();
    });
    els.newGroupBtn.addEventListener("click", () => openGroupEditor("create"));
    els.inviteSearchInput.addEventListener("input", () => {
      state.inviteSearchTerm = String(els.inviteSearchInput.value || "").trim();
      renderInviteDirectory();
    });
    els.navLogoutBtn.addEventListener("click", () => {
      stopTyping();
      if (state.call.callId) {
        finishCall(true);
      }
      window.AuthStore.clearUser();
      window.location.replace("/login.html");
    });
    els.changeAvatarBtn.addEventListener("click", () => els.profileAvatarInput.click());
    els.removeAvatarBtn.addEventListener("click", () => updateAvatar(null));
    els.profileAvatarInput.addEventListener("change", async () => {
      await uploadAvatar(els.profileAvatarInput.files && els.profileAvatarInput.files[0]);
    });
    els.groupAvatarInput.addEventListener("change", async () => {
      await uploadGroupAvatar(els.groupAvatarInput.files && els.groupAvatarInput.files[0]);
    });
    els.saveUsernameBtn.addEventListener("click", saveUsername);
    els.usernameInput.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        await saveUsername();
      }
    });
    els.userSearchInput.addEventListener("input", renderConversations);

    els.messageInput.addEventListener("input", () => {
      resizeInput();
      if (!hasSelectedChat()) return;
      if (!els.messageInput.value.trim()) {
        stopTyping();
        return;
      }
      emitTyping();
      resetTypingTimer();
    });
    els.messageInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        els.messageForm.requestSubmit();
      }
    });
    els.messageInput.addEventListener("blur", stopTyping);
    els.messageForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      await sendText();
    });

    els.emojiToggleBtn.addEventListener("click", toggleEmoji);
    els.imageUploadBtn.addEventListener("click", () => els.imageInput.click());
    els.imageInput.addEventListener("change", async () => {
      await sendImage(els.imageInput.files && els.imageInput.files[0]);
    });
    els.gifToggleBtn.addEventListener("click", () => toggleGif());
    els.closeGifBtn.addEventListener("click", () => toggleGif(false));
    els.gifSearchInput.addEventListener("input", () => {
      if (state.gifTimer) clearTimeout(state.gifTimer);
      const q = els.gifSearchInput.value;
      state.gifTimer = setTimeout(() => searchGifs(q), 300);
    });

    els.callToggleBtn.addEventListener("click", async () => {
      await startCallFromCurrentChat();
    });
    els.acceptCallBtn.addEventListener("click", async () => {
      await acceptIncomingCall();
    });
    els.rejectCallBtn.addEventListener("click", () => {
      rejectIncomingCall();
    });
    els.shareScreenBtn.addEventListener("click", async () => {
      await toggleScreenShare();
    });
    els.toggleCallViewBtn.addEventListener("click", async () => {
      await toggleCallMediaVisibility();
    });
    els.fullscreenCallBtn.addEventListener("click", async () => {
      await toggleCallFullscreen();
    });
    els.muteCallBtn.addEventListener("click", () => {
      toggleMuteCall();
    });
    els.endCallBtn.addEventListener("click", () => {
      finishCall(true, "Call ended.");
    });
    [els.remoteVideoPanel, els.localVideoPanel].forEach((panel) => {
      if (!panel) {
        return;
      }
      panel.addEventListener("dblclick", async () => {
        await toggleCallFullscreen(panel);
      });
    });

    els.closeGroupModalBtn.addEventListener("click", closeGroupEditor);
    els.cancelGroupBtn.addEventListener("click", closeGroupEditor);
    els.saveGroupBtn.addEventListener("click", async () => {
      await saveGroupEditor();
    });
    els.closeInviteModalBtn.addEventListener("click", closeInviteModal);
    els.cancelInviteBtn.addEventListener("click", closeInviteModal);
    els.groupNameInput.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        await saveGroupEditor();
      }
    });
    els.inviteSearchInput.addEventListener("keydown", async (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        state.inviteSearchTerm = String(els.inviteSearchInput.value || "").trim();
        renderInviteDirectory();
      }
    });
    els.groupModal.addEventListener("click", (e) => {
      if (e.target === els.groupModal) {
        closeGroupEditor();
      }
    });
    els.inviteModal.addEventListener("click", (e) => {
      if (e.target === els.inviteModal) {
        closeInviteModal();
      }
    });
    els.closeGroupCallModalBtn.addEventListener("click", closeGroupCallModal);
    els.cancelGroupCallBtn.addEventListener("click", closeGroupCallModal);
    els.groupCallModal.addEventListener("click", (e) => {
      if (e.target === els.groupCallModal) {
        closeGroupCallModal();
      }
    });

    els.chatMenuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const willShow = els.chatMenuPanel.classList.contains("hidden");
      toggleChatMenu(willShow);
    });

    document.addEventListener("click", (e) => {
      if (!els.chatMenuPanel || els.chatMenuPanel.classList.contains("hidden")) {
        return;
      }
      if (els.chatMenuPanel.contains(e.target) || els.chatMenuBtn.contains(e.target)) {
        return;
      }
      toggleChatMenu(false);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        setSettings(false);
        toggleGif(false);
        toggleChatMenu(false);
        els.emojiPanel.classList.add("hidden");
        closeGroupEditor();
        closeInviteModal();
        closeGroupCallModal();
        if (state.call.pendingIncoming) {
          rejectIncomingCall();
        }
      }
    });

    document.addEventListener("fullscreenchange", () => {
      syncFullscreenButton();
    });
    window.addEventListener("resize", () => {
      syncMobileLayout();
    });

    window.addEventListener("beforeunload", () => {
      clearAnnouncementTimers();
      if (state.call.callId) {
        finishCall(true);
      }
      stopTyping();
    });
  }

  async function init() {
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
    renderCurrentUser();
    buildEmojiPanel();
    setHeader();
    showAnnouncement(
      "Add friends, create groups, and share your screen from calls. Accept a friend request before starting a new DM."
    );
    resetCallUi();
    toggleChatMenu(false);
    syncMobileLayout();
    await loadWebRtcConfig();
    bindSocket();
    bindUi();
    await refreshChatLists();
    syncMobileLayout();
  }

  init();
});
