(function () {
  const hasHttpHost =
    window.location.protocol.startsWith("http") && Boolean(window.location.host);

  const fallbackBase = "http://localhost:3000";
  const baseUrl = hasHttpHost
    ? `${window.location.protocol}//${window.location.host}`
    : fallbackBase;

  window.APP_CONFIG = {
    API_BASE_URL: baseUrl,
    SOCKET_URL: baseUrl,
  };
})();
