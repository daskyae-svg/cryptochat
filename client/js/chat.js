document.addEventListener("DOMContentLoaded", () => {
  const currentUser = window.AuthStore.getUser();
  if (!currentUser) {
    window.location.replace("/login.html");
    return;
  }

  const currentUserLabel = document.getElementById("currentUserLabel");
  const activeChatLabel = document.getElementById("activeChatLabel");
  const socketStatus = document.getElementById("socketStatus");
  const statusMessage = document.getElementById("statusMessage");
  const userList = document.getElementById("userList");
  const messagesContainer = document.getElementById("messagesContainer");
  const messageForm = document.getElementById("messageForm");
  const messageInput = document.getElementById("messageInput");
  const logoutBtn = document.getElementById("logoutBtn");
  const refreshUsersBtn = document.getElementById("refreshUsersBtn");

  currentUserLabel.textContent = `Logged in as ${currentUser.username}`;

  let selectedUser = null;
  let users = [];
  let displayedMessageIds = new Set();
  const unreadUserIds = new Set();

  const socket = io(window.APP_CONFIG.SOCKET_URL, {
    transports: ["websocket", "polling"],
  });

  socket.on("connect", () => {
    socketStatus.textContent = "Online";
    socketStatus.classList.add("online");
    socket.emit("register", { userId: currentUser.id });
  });

  socket.on("disconnect", () => {
    socketStatus.textContent = "Disconnected";
    socketStatus.classList.remove("online");
  });

  socket.on("receive_message", (message) => {
    if (!message || !message.id) {
      return;
    }

    const isForOpenConversation =
      selectedUser &&
      message.senderId === selectedUser.id &&
      message.receiverId === currentUser.id;

    if (isForOpenConversation) {
      renderMessage(message);
      return;
    }

    if (message.senderId !== currentUser.id) {
      unreadUserIds.add(message.senderId);
      renderUserList();
    }
  });

  async function loadUsers() {
    try {
      const response = await window.Api.fetchUsers(currentUser.id);
      users = response.users || [];
      renderUserList();

      if (!selectedUser && users.length > 0) {
        selectUser(users[0].id);
      }
    } catch (error) {
      statusMessage.textContent = error.message;
    }
  }

  function renderUserList() {
    userList.innerHTML = "";

    if (users.length === 0) {
      const emptyState = document.createElement("li");
      emptyState.textContent = "No other users yet.";
      userList.appendChild(emptyState);
      return;
    }

    users.forEach((user) => {
      const listItem = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "user-item";
      button.textContent = user.username;

      if (selectedUser && selectedUser.id === user.id) {
        button.classList.add("active");
      }
      if (unreadUserIds.has(user.id)) {
        button.classList.add("unread");
      }

      button.addEventListener("click", () => {
        selectUser(user.id);
      });

      listItem.appendChild(button);
      userList.appendChild(listItem);
    });
  }

  async function selectUser(userId) {
    const target = users.find((user) => user.id === userId);
    if (!target) {
      return;
    }

    selectedUser = target;
    unreadUserIds.delete(userId);
    activeChatLabel.textContent = `Chat with ${selectedUser.username}`;
    renderUserList();
    await loadConversation();
    messageInput.focus();
  }

  function clearConversation() {
    displayedMessageIds = new Set();
    messagesContainer.innerHTML = "";
  }

  async function loadConversation() {
    if (!selectedUser) {
      return;
    }

    try {
      clearConversation();
      const response = await window.Api.fetchMessages(selectedUser.id, currentUser.id);
      const messages = response.messages || [];
      messages.forEach((message) => renderMessage(message));
    } catch (error) {
      statusMessage.textContent = error.message;
    }
  }

  function createTimestamp(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return "";
    }
    return date.toLocaleString();
  }

  function renderMessage(message) {
    if (displayedMessageIds.has(message.id)) {
      return;
    }
    displayedMessageIds.add(message.id);

    const wrapper = document.createElement("article");
    wrapper.className = `message ${
      message.senderId === currentUser.id ? "self" : "other"
    }`;

    const text = document.createElement("p");
    text.className = "message-text";
    text.textContent = message.message;

    const timestamp = document.createElement("div");
    timestamp.className = "message-time";
    timestamp.textContent = createTimestamp(message.createdAt);

    wrapper.appendChild(text);
    wrapper.appendChild(timestamp);
    messagesContainer.appendChild(wrapper);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function sendMessageWithSocket(payload) {
    return new Promise((resolve, reject) => {
      socket.emit("send_message", payload, (ack) => {
        if (ack && ack.ok) {
          resolve(ack.message);
          return;
        }
        reject(new Error((ack && ack.error) || "Failed to send message."));
      });
    });
  }

  messageForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!selectedUser) {
      statusMessage.textContent = "Select a user before sending a message.";
      return;
    }

    const text = messageInput.value.trim();
    if (!text) {
      return;
    }

    messageInput.value = "";
    statusMessage.textContent = "";

    const payload = {
      senderId: currentUser.id,
      receiverId: selectedUser.id,
      message: text,
    };

    try {
      let sentMessage;
      if (socket.connected) {
        sentMessage = await sendMessageWithSocket(payload);
      } else {
        const response = await window.Api.sendMessage(
          payload.senderId,
          payload.receiverId,
          payload.message
        );
        sentMessage = response.data;
      }
      renderMessage(sentMessage);
    } catch (error) {
      statusMessage.textContent = error.message;
    }
  });

  refreshUsersBtn.addEventListener("click", () => {
    loadUsers();
  });

  logoutBtn.addEventListener("click", () => {
    window.AuthStore.clearUser();
    window.location.replace("/login.html");
  });

  loadUsers();
});
