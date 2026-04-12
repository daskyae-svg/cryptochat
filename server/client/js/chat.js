document.addEventListener("DOMContentLoaded", () => {
  const currentUser = window.AuthStore.getUser();
  if (!currentUser) {
    window.location.replace("/login.html");
    return;
  }

  const $ = (id) => document.getElementById(id);
  const MSG = { TEXT: "text", IMAGE: "image", GIF: "gif", DELETED: "deleted" };
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

  const els = {
    currentUserLabel: $("currentUserLabel"),
    currentUserRailAvatar: $("currentUserRailAvatar"),
    activeChatLabel: $("activeChatLabel"),
    activeUserAvatar: $("activeUserAvatar"),
    typingIndicator: $("typingIndicator"),
    socketStatus: $("socketStatus"),
    statusMessage: $("statusMessage"),
    conversationList: $("conversationList"),
    userSearchInput: $("userSearchInput"),
    messagesContainer: $("messagesContainer"),
    messageForm: $("messageForm"),
    messageInput: $("messageInput"),
    emojiPanel: $("emojiPanel"),
    emojiToggleBtn: $("emojiToggleBtn"),
    imageUploadBtn: $("imageUploadBtn"),
    imageInput: $("imageInput"),
    gifToggleBtn: $("gifToggleBtn"),
    gifPicker: $("gifPicker"),
    closeGifBtn: $("closeGifBtn"),
    manualGifBtn: $("manualGifBtn"),
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
    changeAvatarBtn: $("changeAvatarBtn"),
    removeAvatarBtn: $("removeAvatarBtn"),
    profileAvatarInput: $("profileAvatarInput"),
  };

  const state = {
    conversations: [],
    selectedUserId: null,
    selectedUsername: "",
    selectedAvatarUrl: null,
    messageNodes: new Map(),
    messageStatus: new Map(),
    unread: new Set(),
    typingUsers: new Set(),
    userMap: new Map(),
    typingSent: false,
    typingTimer: null,
    gifTimer: null,
  };

  const socket = io(window.APP_CONFIG.SOCKET_URL, { transports: ["websocket", "polling"] });
  const THEME_KEY = "cryptochat_theme";
  const TYPING_MS = 1200;
  const BOTTOM_GAP = 110;
  const MAX_IMG = 2 * 1024 * 1024;
  const GIF_DEFAULT = "funny";

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
  function updateSocketStatus() {
    if (socket.connected) {
      els.socketStatus.textContent = "Online";
      els.socketStatus.classList.add("online");
      return;
    }
    els.socketStatus.textContent = "Offline";
    els.socketStatus.classList.remove("online");
  }
  const isOpenConv = (m) =>
    state.selectedUserId &&
    ((m.senderId === currentUser.id && m.receiverId === state.selectedUserId) ||
      (m.senderId === state.selectedUserId && m.receiverId === currentUser.id));
  const preview = (type, text) => {
    if (type === MSG.DELETED) return "Message deleted";
    if (type === MSG.IMAGE) return text ? `Photo: ${text}` : "Photo";
    if (type === MSG.GIF) return text ? `GIF: ${text}` : "GIF";
    return (String(text || "").replace(/\s+/g, " ").trim() || "Start chatting").slice(0, 70);
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

  function renderConversations() {
    const term = els.userSearchInput.value.trim().toLowerCase();
    els.conversationList.innerHTML = "";
    const list = state.conversations.filter((c) => c.username.toLowerCase().includes(term));
    if (!list.length) {
      const p = document.createElement("p");
      p.className = "status";
      p.textContent = "No matching users.";
      els.conversationList.appendChild(p);
      return;
    }

    list.forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "conversation-item";
      if (c.userId === state.selectedUserId) b.classList.add("active");
      if (state.unread.has(c.userId)) b.classList.add("unread");

      const av = document.createElement("div");
      av.className = "avatar";
      paintAvatar(av, c.username, c.avatarUrl);

      const main = document.createElement("div");
      main.className = "conversation-main";
      const top = document.createElement("div");
      top.className = "conversation-top";
      const u = document.createElement("span");
      u.className = "conversation-username";
      u.textContent = c.username;
      const tm = document.createElement("span");
      tm.className = "conversation-time";
      tm.textContent = c.lastMessage ? tConv(c.lastMessage.createdAt) : "";
      top.append(u, tm);

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
      els.conversationList.appendChild(b);
    });
  }

  function setHeader() {
    if (!state.selectedUserId) {
      els.activeChatLabel.textContent = "Select a conversation";
      paintAvatar(els.activeUserAvatar, "?", null);
      els.typingIndicator.classList.add("hidden");
      els.typingIndicator.textContent = "";
      return;
    }
    els.activeChatLabel.textContent = state.selectedUsername;
    paintAvatar(els.activeUserAvatar, state.selectedUsername, state.selectedAvatarUrl);
    if (state.typingUsers.has(state.selectedUserId)) {
      els.typingIndicator.textContent = `${state.selectedUsername} is typing`;
      els.typingIndicator.classList.remove("hidden");
    } else {
      els.typingIndicator.textContent = "";
      els.typingIndicator.classList.add("hidden");
    }
  }

  function sortConversations() {
    state.conversations.sort((a, b) => {
      const at = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const bt = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return bt - at || a.username.localeCompare(b.username);
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
    const row = document.createElement("article");
    row.className = `message-row ${self ? "self" : "other"}`;
    row.dataset.messageId = String(m.id);

    const bubble = document.createElement("div");
    bubble.className = "message-bubble";
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
      st.textContent = m.messageType === MSG.DELETED ? "" : state.messageStatus.get(m.id) || m.status || "sent";
      meta.appendChild(st);
      if (m.messageType !== MSG.DELETED) {
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
    if (m.status) state.messageStatus.set(m.id, m.status);
    if (m.messageType === MSG.DELETED) state.messageStatus.delete(m.id);
    const keepBottom = force || nearBottom() || m.senderId === currentUser.id;
    const old = state.messageNodes.get(m.id);
    const node = messageNode(m);
    if (old) old.replaceWith(node);
    else els.messagesContainer.appendChild(node);
    state.messageNodes.set(m.id, node);
    if (keepBottom) scrollBottom(true);
  }

  function updateStatus(id, status) {
    if (!id || !status) return;
    state.messageStatus.set(id, status);
    const node = state.messageNodes.get(id);
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
          lastMessage: c.lastMessage || null,
        };
        state.userMap.set(x.userId, { username: x.username, avatarUrl: x.avatarUrl });
        return x;
      });
      sortConversations();
      renderConversations();

      if (!state.conversations.length) {
        state.selectedUserId = null;
        state.selectedUsername = "";
        state.selectedAvatarUrl = null;
        setHeader();
        state.messageNodes.clear();
        els.messagesContainer.innerHTML = "";
        setStatus("No users available yet.", false);
        return;
      }

      if (!state.conversations.some((c) => c.userId === state.selectedUserId)) {
        await selectConversation(state.conversations[0].userId);
      } else {
        const c = state.conversations.find((it) => it.userId === state.selectedUserId);
        state.selectedUsername = c.username;
        state.selectedAvatarUrl = c.avatarUrl;
        setHeader();
        renderConversations();
      }
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  async function loadMessages() {
    if (!state.selectedUserId) return;
    try {
      const { messages = [] } = await window.Api.fetchMessages(state.selectedUserId, currentUser.id);
      state.messageNodes.clear();
      els.messagesContainer.innerHTML = "";
      const f = document.createDocumentFragment();
      messages.forEach((m) => {
        if (m.status) state.messageStatus.set(m.id, m.status);
        const n = messageNode(m);
        state.messageNodes.set(m.id, n);
        f.appendChild(n);
      });
      els.messagesContainer.appendChild(f);
      scrollBottom(true);
    } catch (e) {
      setStatus(e.message, true);
    }
  }

  async function selectConversation(userId) {
    const c = state.conversations.find((it) => it.userId === userId);
    if (!c) return;
    if (state.selectedUserId && state.selectedUserId !== userId) stopTyping();
    state.selectedUserId = userId;
    state.selectedUsername = c.username;
    state.selectedAvatarUrl = c.avatarUrl;
    state.unread.delete(userId);
    state.typingUsers.delete(userId);
    setHeader();
    renderConversations();
    await loadMessages();
    els.messageInput.focus();
  }

  function updateConvFromMessage(m) {
    const uid = m.senderId === currentUser.id ? m.receiverId : m.senderId;
    let c = state.conversations.find((x) => x.userId === uid);
    if (!c) {
      const ref = state.userMap.get(uid) || {};
      c = { userId: uid, username: ref.username || `User ${uid}`, avatarUrl: ref.avatarUrl || null, lastMessage: null };
      state.conversations.push(c);
    }
    c.lastMessage = { id: m.id, senderId: m.senderId, messageType: m.messageType, preview: preview(m.messageType, m.message), createdAt: m.createdAt };
    sortConversations();
    renderConversations();
  }

  async function sendMessage(body) {
    if (!state.selectedUserId) {
      setStatus("Choose a conversation first.", true);
      return null;
    }
    const payload = {
      senderId: currentUser.id,
      receiverId: state.selectedUserId,
      message: body.message || "",
      messageType: body.messageType || MSG.TEXT,
      mediaUrl: body.mediaUrl || null,
    };
    try {
      const sent = socket.connected
        ? await emitAck("send_message", payload)
        : (await window.Api.sendMessage(payload)).data;
      upsertMessage(sent, true);
      updateConvFromMessage(sent);
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

  function emitTyping() {
    if (!socket.connected || !state.selectedUserId || state.typingSent) return;
    socket.emit("typing", { senderId: currentUser.id, receiverId: state.selectedUserId });
    state.typingSent = true;
  }

  function stopTyping() {
    if (!socket.connected || !state.selectedUserId || !state.typingSent) return;
    socket.emit("stop_typing", { senderId: currentUser.id, receiverId: state.selectedUserId });
    state.typingSent = false;
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

  function syncUserAvatar(uid, avatarUrl) {
    const av = norm(avatarUrl);
    if (state.userMap.has(uid)) state.userMap.get(uid).avatarUrl = av;
    const c = state.conversations.find((x) => x.userId === uid);
    if (c) c.avatarUrl = av;
    if (state.selectedUserId === uid) {
      state.selectedAvatarUrl = av;
      setHeader();
    }
  }

  function bindSocket() {
    socket.on("connect", () => {
      els.socketStatus.textContent = "Online";
      els.socketStatus.classList.add("online");
      socket.emit("register", { userId: currentUser.id });
    });
    socket.on("disconnect", () => {
      els.socketStatus.textContent = "Offline";
      els.socketStatus.classList.remove("online");
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
    socket.on("stop_typing", (p) => {
      const sid = Number(p && p.senderId);
      if (!sid) return;
      state.typingUsers.delete(sid);
      setHeader();
      renderConversations();
    });
    socket.on("user_profile_updated", (p) => {
      const uid = Number(p && p.userId);
      if (!uid) return;
      const av = norm(p.avatarUrl);
      if (uid === currentUser.id) {
        currentUser.avatarUrl = av;
        window.AuthStore.saveUser(currentUser);
        renderCurrentUser();
      }
      syncUserAvatar(uid, av);
      renderConversations();
    });
  }

  function bindUi() {
    els.navChatsBtn.addEventListener("click", () => {
      setSettings(false);
      els.messageInput.focus();
    });
    els.navProfileBtn.addEventListener("click", () => setSettings(true));
    els.navSettingsBtn.addEventListener("click", () => setSettings(true));
    els.closeSettingsBtn.addEventListener("click", () => setSettings(false));
    els.themeToggleBtn.addEventListener("click", () => {
      const next = document.body.classList.contains("theme-dark") ? "light" : "dark";
      localStorage.setItem(THEME_KEY, next);
      applyTheme(next);
    });
    els.refreshUsersBtn.addEventListener("click", () => loadConversations());
    els.navLogoutBtn.addEventListener("click", () => {
      stopTyping();
      window.AuthStore.clearUser();
      window.location.replace("/login.html");
    });
    els.changeAvatarBtn.addEventListener("click", () => els.profileAvatarInput.click());
    els.removeAvatarBtn.addEventListener("click", () => updateAvatar(null));
    els.profileAvatarInput.addEventListener("change", async () => {
      await uploadAvatar(els.profileAvatarInput.files && els.profileAvatarInput.files[0]);
    });
    els.userSearchInput.addEventListener("input", renderConversations);

    els.messageInput.addEventListener("input", () => {
      resizeInput();
      if (!state.selectedUserId) return;
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
    els.manualGifBtn.addEventListener("click", async () => {
      const raw = window.prompt("Paste a direct GIF URL:");
      if (!raw) return;
      const url = raw.trim();
      if (!/^https?:\/\//i.test(url)) {
        setStatus("Please provide a valid http(s) GIF URL.", true);
        return;
      }
      const sent = await sendMessage({ messageType: MSG.GIF, mediaUrl: url, message: els.messageInput.value });
      if (sent) {
        clearInput();
        toggleGif(false);
      }
    });
    els.closeGifBtn.addEventListener("click", () => toggleGif(false));
    els.gifSearchInput.addEventListener("input", () => {
      if (state.gifTimer) clearTimeout(state.gifTimer);
      const q = els.gifSearchInput.value;
      state.gifTimer = setTimeout(() => searchGifs(q), 300);
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        setSettings(false);
        toggleGif(false);
        els.emojiPanel.classList.add("hidden");
      }
    });
  }

  async function init() {
    applyTheme(localStorage.getItem(THEME_KEY) || "light");
    renderCurrentUser();
    buildEmojiPanel();
    setHeader();
    updateSocketStatus();
    bindSocket();
    bindUi();
    await loadConversations();
  }

  init();
});
