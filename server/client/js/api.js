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
    sendMessage(senderId, receiverId, message) {
      return request("/send-message", {
        method: "POST",
        body: { senderId, receiverId, message },
      });
    },
    fetchMessages(otherUserId, currentUserId) {
      return request(`/messages/${otherUserId}?currentUserId=${currentUserId}`);
    },
    fetchUsers(excludeUserId) {
      return request(`/users?exclude=${excludeUserId}`);
    },
  };
})();
