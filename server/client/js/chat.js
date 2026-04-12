document.addEventListener("DOMContentLoaded", () => {
  const currentUser = window.AuthStore.getUser();
  if (!currentUser) {
    window.location.replace("/login.html");
    return;
  }

  const THEME_STORAGE_KEY = "cryptochat_theme";
  const TYPING_DEBOUNCE_MS = 1200;
  const SCROLL_BOTTOM_THRESHOLD = 110;
  const MAX_IMAGE_SIZE_BYTES = 2 * 1024 * 1024;
  const DEFAULT_GIF_SEARCH = "funny";
  const EMOJIS = [
    "😀",
    "😄",
    "😂",
    "🥳",
    "😍",
    "😎",
    "🤝",
    "🔥",
    "🎉",
    "👏",
    "❤️",
    "👌",
    "💡",
    "😅",
    "😭",
    "😴",
    "😇",
    "🤖",
  ];

  const MESSAGE_TYPES = {
    TEXT: "text",
    IMAGE: "image",
    GIF: "gif",
    DELETED: "deleted",
  };

  const currentUserLabel = document.getElementById("currentUserLabel");
  const activeChatLabel = document.getElementById("activeChatLabel");
  const activeUserAvatar = document.getElementById("activeUserAvatar");
  const typingIndicator = document.getElementById("typingIndicator");
  const socketStatus = document.getElementById("socketStatus");
  const statusMessage = document.getElementById("statusMessage");
  const conversationList = document.getElementById("conversationList");
  const userSearchInput = document.getElementById("userSearchInput");
  const messagesContainer = document.getElementById("messagesContainer");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const emojiPanel = document.getElementById("emojiPanel");
  const emojiToggleBtn = document.getElementById("emojiToggleBtn");
  const imageUploadBtn = document.getElementById("imageUploadBtn");
  const imageInput = document.getElementById("imageInput");
  const gifToggleBtn = document.getElementById("gifToggleBtn");
  const gifPicker = document.getElementById("gifPicker");
  const closeGifBtn = document.getElementById("closeGifBtn");
  const manualGifBtn = document.getElementById("manualGifBtn");
  const gifSearchInput = document.getElementById("gifSearchInput");
  const gifResults = document.getElementById("gifResults");
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  const refreshUsersBtn = document.getElementById("refreshUsersBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  currentUserLabel.textContent = `@${currentUser.username}`;

  const state = {
    conversations: [],
    selectedUserId: null,
    selectedUsername: "",
    messageElementsById: new Map(),
    messageStatusById: new Map(),
    unreadUserIds: new Set(),
    typingUserIds: new Set(),
    userMap: new Map(),
    isTypingEmitted: false,
    typingTimeoutId: null,
    gifSearchTimeoutId: null,
  };

  const socket = io(window.APP_CONFIG.SOCKET_URL, {
    transports: ["websocket", "polling"],
  });

  function getInitials(username) {
    const parts = String(username || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    if (parts.length === 0) {
      return "?";
    }
    const initials = parts.slice(0, 2).map((part) => part[0].toUpperCase());
    return initials.join("");
  }

  function formatTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  function formatConversationTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }

    const now = new Date();
    const sameDay =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (sameDay) {
      return formatTime(date);
    }

    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${month}/${day}`;
  }

  function setStatus(message, isError) {
    statusMessage.textContent = message || "";
    statusMessage.style.color = isError ? "var(--danger)" : "var(--muted)";
  }

  function isNearBottom() {
    const distanceToBottom =
      messagesContainer.scrollHeight -
      messagesContainer.scrollTop -
      messagesContainer.clientHeight;
    return distanceToBottom <= SCROLL_BOTTOM_THRESHOLD;
  }

  function scrollToBottom(force) {
    if (!force && !isNearBottom()) {
      return;
    }
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function updateSocketStatus() {
    if (socket.connected) {
      socketStatus.textContent = "Online";
      socketStatus.classList.add("online");
      return;
    }
    socketStatus.textContent = "Offline";
    socketStatus.classList.remove("online");
  }

  function applyTheme(theme) {
    const isDark = theme === "dark";
    document.body.classList.toggle("theme-dark", isDark);
    themeToggleBtn.textContent = isDark ? "Light Mode" : "Dark Mode";
  }

  function initTheme() {
    const storedTheme = localStorage.getItem(THEME_STORAGE_KEY) || "light";
    applyTheme(storedTheme);
  }

  function toggleTheme() {
    const nextTheme = document.body.classList.contains("theme-dark") ? "light" : "dark";
    localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
    applyTheme(nextTheme);
  }

  function conversationPreview(messageType, messageText) {
    if (messageType === MESSAGE_TYPES.DELETED) {
      return "Message deleted";
    }
    if (messageType === MESSAGE_TYPES.IMAGE) {
      return messageText ? `Photo: ${messageText}` : "Photo";
    }
    if (messageType === MESSAGE_TYPES.GIF) {
      return messageText ? `GIF: ${messageText}` : "GIF";
    }
    return messageText || "Start chatting";
  }

  function sortConversations() {
    state.conversations.sort((left, right) => {
      const leftTime = left.lastMessage ? new Date(left.lastMessage.createdAt).getTime() : 0;
      const rightTime = right.lastMessage ? new Date(right.lastMessage.createdAt).getTime() : 0;
      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }
      return left.username.localeCompare(right.username);
    });
  }

  function renderConversations() {
    const term = userSearchInput.value.trim().toLowerCase();
    conversationList.innerHTML = "";

    const filtered = state.conversations.filter((conversation) =>
      conversation.username.toLowerCase().includes(term)
    );

    if (filtered.length === 0) {
      const empty = document.createElement("p");
      empty.className = "status";
      empty.textContent = "No matching users.";
      conversationList.appendChild(empty);
      return;
    }

    filtered.forEach((conversation) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "conversation-item";

      if (conversation.userId === state.selectedUserId) {
        button.classList.add("active");
      }
      if (state.unreadUserIds.has(conversation.userId)) {
        button.classList.add("unread");
      }

      const avatar = document.createElement("div");
      avatar.className = "avatar";
      avatar.textContent = getInitials(conversation.username);

      const content = document.createElement("div");
      content.className = "conversation-main";

      const top = document.createElement("div");
      top.className = "conversation-top";

      const username = document.createElement("span");
      username.className = "conversation-username";
      username.textContent = conversation.username;

      const time = document.createElement("span");
      time.className = "conversation-time";
      time.textContent = conversation.lastMessage
        ? formatConversationTime(conversation.lastMessage.createdAt)
        : "";

      top.appendChild(username);
      top.appendChild(time);

      const preview = document.createElement("div");
      preview.className = "conversation-preview";
      if (state.typingUserIds.has(conversation.userId)) {
        preview.textContent = "Typing...";
      } else if (conversation.lastMessage) {
        preview.textContent = conversation.lastMessage.preview;
      } else {
        preview.textContent = "Say hello";
      }

      content.appendChild(top);
      content.appendChild(preview);
      button.appendChild(avatar);
      button.appendChild(content);

      button.addEventListener("click", () => {
        selectConversation(conversation.userId);
      });

      conversationList.appendChild(button);
    });
  }

  function setActiveConversationHeader() {
    if (!state.selectedUserId) {
      activeChatLabel.textContent = "Select a conversation";
      activeUserAvatar.textContent = "?";
      typingIndicator.textContent = "";
      typingIndicator.classList.add("hidden");
      return;
    }

    activeChatLabel.textContent = state.selectedUsername;
    activeUserAvatar.textContent = getInitials(state.selectedUsername);
    updateTypingIndicator();
  }

  function updateTypingIndicator() {
    if (!state.selectedUserId || !state.typingUserIds.has(state.selectedUserId)) {
      typingIndicator.textContent = "";
      typingIndicator.classList.add("hidden");
      return;
    }

    typingIndicator.textContent = `${state.selectedUsername} is typing`;
    typingIndicator.classList.remove("hidden");
  }

  function updateConversationWithMessage(message) {
    const otherUserId =
      message.senderId === currentUser.id ? message.receiverId : message.senderId;

    let conversation = state.conversations.find((item) => item.userId === otherUserId);
    if (!conversation) {
      const userFromMap = state.userMap.get(otherUserId);
      conversation = {
        userId: otherUserId,
        username: userFromMap ? userFromMap.username : `User ${otherUserId}`,
        lastMessage: null,
      };
      state.conversations.push(conversation);
    }

    conversation.lastMessage = {
      id: message.id,
      senderId: message.senderId,
      messageType: message.messageType,
      preview: conversationPreview(message.messageType, String(message.message || "").trim()),
      createdAt: message.createdAt,
    };

    sortConversations();
    renderConversations();
  }

  function clearMessagesView() {
    state.messageElementsById.clear();
    messagesContainer.innerHTML = "";
  }

  function appendTextWithBreaks(target, text) {
    const parts = String(text || "").split("\n");
    parts.forEach((part, index) => {
      target.appendChild(document.createTextNode(part));
      if (index < parts.length - 1) {
        target.appendChild(document.createElement("br"));
      }
    });
  }

  function appendFormattedMessage(target, text) {
    const messageText = String(text || "");
    const linkRegex = /(https?:\/\/[^\s<]+|www\.[^\s<]+)/gi;
    let cursor = 0;
    let match = linkRegex.exec(messageText);

    while (match) {
      appendTextWithBreaks(target, messageText.slice(cursor, match.index));

      const urlText = match[0];
      const href = urlText.startsWith("http") ? urlText : `https://${urlText}`;
      const link = document.createElement("a");
      link.href = href;
      link.textContent = urlText;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      target.appendChild(link);

      cursor = match.index + urlText.length;
      match = linkRegex.exec(messageText);
    }

    appendTextWithBreaks(target, messageText.slice(cursor));
  }

  function createMessageNode(message) {
    const row = document.createElement("article");
    const isSelf = message.senderId === currentUser.id;
    row.className = `message-row ${isSelf ? "self" : "other"}`;
    row.dataset.messageId = String(message.id);

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";

    if ((message.messageType === MESSAGE_TYPES.IMAGE || message.messageType === MESSAGE_TYPES.GIF) && message.mediaUrl) {
      const media = document.createElement("img");
      media.className = "message-media";
      media.src = message.mediaUrl;
      media.alt = message.messageType === MESSAGE_TYPES.GIF ? "GIF message" : "Image message";
      media.loading = "lazy";
      bubble.appendChild(media);
    }

    if (message.messageType === MESSAGE_TYPES.DELETED) {
      const deleted = document.createElement("p");
      deleted.className = "message-deleted";
      deleted.textContent = "This message was deleted.";
      bubble.appendChild(deleted);
    } else {
      const text = String(message.message || "");
      if (text.trim()) {
        const textEl = document.createElement("p");
        textEl.className = "message-text";
        appendFormattedMessage(textEl, text);
        bubble.appendChild(textEl);
      }
    }

    row.appendChild(bubble);

    const meta = document.createElement("footer");
    meta.className = "message-meta";

    const time = document.createElement("span");
    time.textContent = formatTime(message.createdAt);
    meta.appendChild(time);

    if (isSelf) {
      const status = document.createElement("span");
      status.dataset.messageStatus = "1";
      if (message.messageType === MESSAGE_TYPES.DELETED) {
        status.textContent = "";
      } else {
        status.textContent = state.messageStatusById.get(message.id) || message.status || "sent";
      }
      meta.appendChild(status);
    }

    if (isSelf && message.messageType !== MESSAGE_TYPES.DELETED) {
      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "delete-message-btn";
      deleteBtn.textContent = "Delete";
      deleteBtn.addEventListener("click", () => {
        deleteMessageById(message.id);
      });
      meta.appendChild(deleteBtn);
    }

    row.appendChild(meta);
    return row;
  }

  function upsertMessage(message, options) {
    const updateOptions = options || {};
    if (!message || !message.id) {
      return;
    }

    if (message.status) {
      state.messageStatusById.set(message.id, message.status);
    }
    if (message.messageType === MESSAGE_TYPES.DELETED) {
      state.messageStatusById.delete(message.id);
    }

    const shouldScroll =
      updateOptions.forceScroll ||
      isNearBottom() ||
      message.senderId === currentUser.id;

    const existing = state.messageElementsById.get(message.id);
    const node = createMessageNode(message);

    if (existing) {
      existing.replaceWith(node);
    } else {
      messagesContainer.appendChild(node);
    }
    state.messageElementsById.set(message.id, node);

    if (shouldScroll) {
      scrollToBottom(true);
    }
  }

  function updateMessageStatus(messageId, status) {
    if (!messageId || !status) {
      return;
    }

    state.messageStatusById.set(messageId, status);
    const existingNode = state.messageElementsById.get(messageId);
    if (!existingNode) {
      return;
    }

    const statusNode = existingNode.querySelector("[data-message-status]");
    if (statusNode) {
      statusNode.textContent = status;
    }
  }

  async function loadConversations() {
    try {
      const response = await window.Api.fetchConversations(currentUser.id);
      const conversations = response.conversations || [];

      state.userMap.clear();
      state.conversations = conversations.map((conversation) => {
        const normalized = {
          userId: conversation.userId,
          username: conversation.username,
          lastMessage: conversation.lastMessage || null,
        };
        state.userMap.set(normalized.userId, {
          id: normalized.userId,
          username: normalized.username,
        });
        return normalized;
      });

      sortConversations();
      renderConversations();

      if (state.conversations.length === 0) {
        setActiveConversationHeader();
        clearMessagesView();
        setStatus("No users available yet.", false);
        return;
      }

      const hasSelected = state.conversations.some(
        (conversation) => conversation.userId === state.selectedUserId
      );

      if (!hasSelected) {
        await selectConversation(state.conversations[0].userId);
      } else {
        renderConversations();
      }
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  async function loadMessagesForSelectedConversation() {
    if (!state.selectedUserId) {
      return;
    }

    try {
      const response = await window.Api.fetchMessages(state.selectedUserId, currentUser.id);
      const messages = response.messages || [];

      clearMessagesView();
      const fragment = document.createDocumentFragment();

      messages.forEach((message) => {
        if (message.status) {
          state.messageStatusById.set(message.id, message.status);
        }
        const node = createMessageNode(message);
        state.messageElementsById.set(message.id, node);
        fragment.appendChild(node);
      });

      messagesContainer.appendChild(fragment);
      scrollToBottom(true);
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  async function selectConversation(userId) {
    const conversation = state.conversations.find((item) => item.userId === userId);
    if (!conversation) {
      return;
    }

    if (state.selectedUserId && state.selectedUserId !== userId) {
      emitStopTyping();
    }

    state.selectedUserId = userId;
    state.selectedUsername = conversation.username;
    state.unreadUserIds.delete(userId);
    state.typingUserIds.delete(userId);
    setActiveConversationHeader();
    renderConversations();
    await loadMessagesForSelectedConversation();
    messageInput.focus();
  }

  function isForOpenConversation(message) {
    if (!state.selectedUserId) {
      return false;
    }
    return (
      (message.senderId === currentUser.id && message.receiverId === state.selectedUserId) ||
      (message.senderId === state.selectedUserId && message.receiverId === currentUser.id)
    );
  }

  function handleIncomingMessage(message) {
    if (!message || !message.id) {
      return;
    }

    updateConversationWithMessage(message);

    if (isForOpenConversation(message)) {
      upsertMessage(message, { forceScroll: false });
      if (message.senderId === state.selectedUserId) {
        state.typingUserIds.delete(state.selectedUserId);
        updateTypingIndicator();
      }
      return;
    }

    if (message.senderId !== currentUser.id) {
      state.unreadUserIds.add(message.senderId);
      renderConversations();
    }
  }

  function handleDeletedMessage(message) {
    if (!message || !message.id) {
      return;
    }

    updateConversationWithMessage(message);
    if (isForOpenConversation(message)) {
      upsertMessage(message, { forceScroll: false });
    }
  }

  function sendWithSocket(eventName, payload) {
    return new Promise((resolve, reject) => {
      socket.emit(eventName, payload, (ack) => {
        if (ack && ack.ok) {
          resolve(ack.message);
          return;
        }
        reject(new Error((ack && ack.error) || "Operation failed."));
      });
    });
  }

  async function sendMessage(payload) {
    if (!state.selectedUserId) {
      setStatus("Choose a conversation first.", true);
      return null;
    }

    const body = {
      senderId: currentUser.id,
      receiverId: state.selectedUserId,
      message: payload.message || "",
      messageType: payload.messageType || MESSAGE_TYPES.TEXT,
      mediaUrl: payload.mediaUrl || null,
    };

    try {
      let sentMessage;
      if (socket.connected) {
        sentMessage = await sendWithSocket("send_message", body);
      } else {
        const response = await window.Api.sendMessage(body);
        sentMessage = response.data;
      }

      upsertMessage(sentMessage, { forceScroll: true });
      updateConversationWithMessage(sentMessage);
      setStatus("", false);
      return sentMessage;
    } catch (error) {
      setStatus(error.message, true);
      return null;
    }
  }

  async function deleteMessageById(messageId) {
    if (!messageId) {
      return;
    }

    const confirmed = window.confirm("Delete this message?");
    if (!confirmed) {
      return;
    }

    try {
      let deletedMessage;
      if (socket.connected) {
        deletedMessage = await sendWithSocket("delete_message", {
          messageId,
          userId: currentUser.id,
        });
      } else {
        const response = await window.Api.deleteMessage(messageId, currentUser.id);
        deletedMessage = response.data;
      }

      handleDeletedMessage(deletedMessage);
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  function emitTyping() {
    if (!socket.connected || !state.selectedUserId) {
      return;
    }

    socket.emit("typing", {
      senderId: currentUser.id,
      receiverId: state.selectedUserId,
    });
    state.isTypingEmitted = true;
  }

  function emitStopTyping() {
    if (!state.isTypingEmitted || !socket.connected || !state.selectedUserId) {
      return;
    }

    socket.emit("stop_typing", {
      senderId: currentUser.id,
      receiverId: state.selectedUserId,
    });
    state.isTypingEmitted = false;
  }

  function resetTypingTimer() {
    if (state.typingTimeoutId) {
      clearTimeout(state.typingTimeoutId);
    }

    state.typingTimeoutId = setTimeout(() => {
      emitStopTyping();
    }, TYPING_DEBOUNCE_MS);
  }

  function autoResizeComposer() {
    messageInput.style.height = "auto";
    const nextHeight = Math.min(messageInput.scrollHeight, 130);
    messageInput.style.height = `${nextHeight}px`;
  }

  function clearComposer() {
    messageInput.value = "";
    autoResizeComposer();
  }

  async function sendTextMessage() {
    const text = messageInput.value;
    if (!text.trim()) {
      return;
    }
    const sentMessage = await sendMessage({
      messageType: MESSAGE_TYPES.TEXT,
      message: text,
    });

    if (sentMessage) {
      clearComposer();
      emitStopTyping();
    }
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(new Error("Failed to read the selected image."));
      reader.readAsDataURL(file);
    });
  }

  async function handleImageUpload(file) {
    if (!file) {
      return;
    }

    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setStatus("Image is too large. Please use a file under 2 MB.", true);
      return;
    }

    try {
      setStatus("Uploading image...", false);
      const dataUrl = await readFileAsDataUrl(file);
      const caption = messageInput.value;
      const sentMessage = await sendMessage({
        messageType: MESSAGE_TYPES.IMAGE,
        mediaUrl: dataUrl,
        message: caption,
      });

      if (sentMessage) {
        clearComposer();
        setStatus("", false);
      }
    } catch (error) {
      setStatus(error.message, true);
    } finally {
      imageInput.value = "";
    }
  }

  function renderGifResults(gifs) {
    gifResults.innerHTML = "";
    if (!gifs || gifs.length === 0) {
      const empty = document.createElement("p");
      empty.className = "status";
      empty.textContent = "No GIFs found.";
      gifResults.appendChild(empty);
      return;
    }

    gifs.forEach((gif) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "gif-card";
      button.title = gif.title || "GIF";

      const image = document.createElement("img");
      image.src = gif.previewUrl || gif.mediaUrl;
      image.alt = gif.title || "GIF";
      image.loading = "lazy";

      button.appendChild(image);
      button.addEventListener("click", async () => {
        const caption = messageInput.value;
        const sentMessage = await sendMessage({
          messageType: MESSAGE_TYPES.GIF,
          mediaUrl: gif.mediaUrl,
          message: caption,
        });

        if (sentMessage) {
          clearComposer();
          toggleGifPicker(false);
        }
      });

      gifResults.appendChild(button);
    });
  }

  async function searchGifs(query) {
    if (!query.trim()) {
      renderGifResults([]);
      return;
    }

    try {
      const response = await window.Api.searchGifs(query, 18);
      renderGifResults(response.gifs || []);
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  function toggleGifPicker(show) {
    const shouldShow =
      typeof show === "boolean" ? show : gifPicker.classList.contains("hidden");

    gifPicker.classList.toggle("hidden", !shouldShow);
    if (!shouldShow) {
      return;
    }

    emojiPanel.classList.add("hidden");
    gifSearchInput.focus();
    if (!gifResults.children.length) {
      gifSearchInput.value = DEFAULT_GIF_SEARCH;
      searchGifs(DEFAULT_GIF_SEARCH);
    }
  }

  function buildEmojiPanel() {
    emojiPanel.innerHTML = "";
    EMOJIS.forEach((emoji) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "emoji-btn";
      button.textContent = emoji;
      button.addEventListener("click", () => {
        messageInput.value += emoji;
        autoResizeComposer();
        messageInput.focus();
      });
      emojiPanel.appendChild(button);
    });
  }

  function toggleEmojiPanel() {
    const shouldOpen = emojiPanel.classList.contains("hidden");
    emojiPanel.classList.toggle("hidden", !shouldOpen);
    if (shouldOpen) {
      gifPicker.classList.add("hidden");
    }
  }

  function wireSocketEvents() {
    socket.on("connect", () => {
      updateSocketStatus();
      socket.emit("register", { userId: currentUser.id });
    });

    socket.on("disconnect", () => {
      updateSocketStatus();
    });

    socket.on("receive_message", (message) => {
      handleIncomingMessage(message);
    });

    socket.on("message_deleted", (message) => {
      handleDeletedMessage(message);
    });

    socket.on("message_status", (payload) => {
      if (!payload || !payload.messageId) {
        return;
      }
      updateMessageStatus(payload.messageId, payload.status || "delivered");
    });

    socket.on("typing", (payload) => {
      const senderId = Number(payload && payload.senderId);
      if (!senderId || senderId === currentUser.id) {
        return;
      }
      state.typingUserIds.add(senderId);
      updateTypingIndicator();
      renderConversations();
    });

    socket.on("stop_typing", (payload) => {
      const senderId = Number(payload && payload.senderId);
      if (!senderId) {
        return;
      }
      state.typingUserIds.delete(senderId);
      updateTypingIndicator();
      renderConversations();
    });
  }

  function wireUiEvents() {
    themeToggleBtn.addEventListener("click", toggleTheme);

    refreshUsersBtn.addEventListener("click", () => {
      loadConversations();
    });

    logoutBtn.addEventListener("click", () => {
      emitStopTyping();
      window.AuthStore.clearUser();
      window.location.replace("/login.html");
    });

    userSearchInput.addEventListener("input", () => {
      renderConversations();
    });

    messageInput.addEventListener("input", () => {
      autoResizeComposer();
      if (!state.selectedUserId) {
        return;
      }

      if (!messageInput.value.trim()) {
        emitStopTyping();
        return;
      }

      if (!state.isTypingEmitted) {
        emitTyping();
      }
      resetTypingTimer();
    });

    messageInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        messageForm.requestSubmit();
      }
    });

    messageInput.addEventListener("blur", () => {
      emitStopTyping();
    });

    messageForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      await sendTextMessage();
    });

    emojiToggleBtn.addEventListener("click", () => {
      toggleEmojiPanel();
    });

    imageUploadBtn.addEventListener("click", () => {
      imageInput.click();
    });

    imageInput.addEventListener("change", async () => {
      const file = imageInput.files && imageInput.files[0];
      await handleImageUpload(file);
    });

    gifToggleBtn.addEventListener("click", () => {
      toggleGifPicker();
    });

    manualGifBtn.addEventListener("click", async () => {
      const pastedUrl = window.prompt("Paste a direct GIF URL:");
      if (!pastedUrl) {
        return;
      }

      const trimmedUrl = pastedUrl.trim();
      const isHttpUrl = /^https?:\/\//i.test(trimmedUrl);
      if (!isHttpUrl) {
        setStatus("Please provide a valid http(s) GIF URL.", true);
        return;
      }

      const caption = messageInput.value;
      const sentMessage = await sendMessage({
        messageType: MESSAGE_TYPES.GIF,
        mediaUrl: trimmedUrl,
        message: caption,
      });

      if (sentMessage) {
        clearComposer();
        toggleGifPicker(false);
      }
    });

    closeGifBtn.addEventListener("click", () => {
      toggleGifPicker(false);
    });

    gifSearchInput.addEventListener("input", () => {
      if (state.gifSearchTimeoutId) {
        clearTimeout(state.gifSearchTimeoutId);
      }
      const term = gifSearchInput.value;
      state.gifSearchTimeoutId = setTimeout(() => {
        searchGifs(term);
      }, 300);
    });
  }

  async function init() {
    initTheme();
    buildEmojiPanel();
    setActiveConversationHeader();
    updateSocketStatus();
    wireSocketEvents();
    wireUiEvents();
    await loadConversations();
  }

  init();
});
