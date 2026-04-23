(function () {
  async function request(path, options) {
    const requestOptions = options || {};
    const response = await fetch(`${window.APP_CONFIG.API_BASE_URL}${path}`, {
      method: requestOptions.method || "GET",
      headers: {
        "Content-Type": "application/json",
      },
      body: requestOptions.body ? JSON.stringify(requestOptions.body) : undefined,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || data.message || "Request failed.");
    }

    return data;
  }

  function toQuery(params) {
    const entries = Object.entries(params || {}).filter(
      ([, value]) => value !== undefined && value !== null && value !== ""
    );
    const searchParams = new URLSearchParams(entries);
    return searchParams.toString();
  }

  window.Api = {
    signup(username, password) {
      return request("/signup", {
        method: "POST",
        body: { username, password },
      });
    },
    login(username, password) {
      return request("/login", {
        method: "POST",
        body: { username, password },
      });
    },
    fetchUsers(excludeUserId, search, viewerId) {
      const query = toQuery({ exclude: excludeUserId, search, viewerId });
      return request(`/users${query ? `?${query}` : ""}`);
    },
    sendDirectInvite(senderId, receiverId) {
      return request("/direct-invites", {
        method: "POST",
        body: { senderId, receiverId },
      });
    },
    respondDirectInvite(inviteId, userId, action) {
      return request(`/direct-invites/${inviteId}/respond`, {
        method: "POST",
        body: { userId, action },
      });
    },
    removeFriend(requesterId, friendId) {
      return request(`/friends/${friendId}/remove`, {
        method: "POST",
        body: { requesterId },
      });
    },
    fetchConversations(userId, search) {
      const query = toQuery({ userId, search });
      return request(`/conversations?${query}`);
    },
    fetchGroups(userId) {
      const query = toQuery({ userId });
      return request(`/groups?${query}`);
    },
    createGroup(userId, name, memberIds) {
      return request("/groups", {
        method: "POST",
        body: { userId, name, memberIds },
      });
    },
    addUserToGroup(groupId, requesterId, newUserId) {
      return request(`/groups/${groupId}/add-user`, {
        method: "POST",
        body: { requesterId, newUserId },
      });
    },
    leaveGroup(groupId, userId) {
      return request(`/groups/${groupId}/leave`, {
        method: "POST",
        body: { userId },
      });
    },
    updateGroupAvatar(groupId, requesterId, avatarUrl) {
      return request(`/groups/${groupId}/avatar`, {
        method: "POST",
        body: { requesterId, avatarUrl },
      });
    },
    fetchMessages(otherUserId, currentUserId) {
      const query = toQuery({ currentUserId });
      return request(`/messages/${otherUserId}?${query}`);
    },
    fetchGroupMessages(groupId, userId) {
      const query = toQuery({ userId });
      return request(`/groups/${groupId}/messages?${query}`);
    },
    sendMessage(payload) {
      return request("/send-message", {
        method: "POST",
        body: payload,
      });
    },
    deleteMessage(messageId, userId) {
      return request("/delete-message", {
        method: "POST",
        body: { messageId, userId },
      });
    },
    updateAvatar(userId, avatarUrl) {
      return request("/profile/avatar", {
        method: "POST",
        body: { userId, avatarUrl },
      });
    },
    updateUsername(userId, newUsername) {
      return request("/profile/username", {
        method: "POST",
        body: { userId, newUsername },
      });
    },
    fetchWebrtcConfig() {
      return request("/webrtc-config");
    },
    searchGifs(query, limit) {
      const queryString = toQuery({ q: query, limit });
      return request(`/gifs/search?${queryString}`);
    },
  };
})();
