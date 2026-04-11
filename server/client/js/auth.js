(function () {
  const STORAGE_KEY = "cryptochat_auth_user";

  function saveUser(user) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user));
  }

  function getUser() {
    const rawUser = localStorage.getItem(STORAGE_KEY);
    if (!rawUser) {
      return null;
    }

    try {
      return JSON.parse(rawUser);
    } catch (error) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
  }

  function clearUser() {
    localStorage.removeItem(STORAGE_KEY);
  }

  window.AuthStore = {
    saveUser,
    getUser,
    clearUser,
  };
})();
