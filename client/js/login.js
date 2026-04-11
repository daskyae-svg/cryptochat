document.addEventListener("DOMContentLoaded", () => {
  const existingUser = window.AuthStore.getUser();
  if (existingUser) {
    window.location.replace("/chat.html");
    return;
  }

  const loginForm = document.getElementById("loginForm");
  const statusMessage = document.getElementById("statusMessage");

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = loginForm.username.value.trim();
    const password = loginForm.password.value;

    try {
      statusMessage.textContent = "Logging in...";
      const response = await window.Api.login(username, password);
      window.AuthStore.saveUser(response.user);
      statusMessage.textContent = "Login successful. Redirecting...";
      setTimeout(() => {
        window.location.replace("/chat.html");
      }, 600);
    } catch (error) {
      statusMessage.textContent = error.message;
    }
  });
});
