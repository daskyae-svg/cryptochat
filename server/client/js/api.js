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
    fetchUsers(excludeUserId, search) {
      const query = toQuery({ exclude: excludeUserId, search });
      return request(`/users${query ? `?${query}` : ""}`);
    },
    fetchConversations(userId, search) {
      const query = toQuery({ userId, search });
      return request(`/conversations?${query}`);
    },
    fetchMessages(otherUserId, currentUserId) {
      const query = toQuery({ currentUserId });
      return request(`/messages/${otherUserId}?${query}`);
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
    searchGifs(query, limit) {
      const queryString = toQuery({ q: query, limit });
      return request(`/gifs/search?${queryString}`);
    },
  };
})();
