document.addEventListener("DOMContentLoaded", () => {
  const existingUser = window.AuthStore.getUser();
  if (existingUser) {
    window.location.replace("/chat.html");
    return;
  }

  const signupForm = document.getElementById("signupForm");
  const statusMessage = document.getElementById("statusMessage");

  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const username = signupForm.username.value.trim();
    const password = signupForm.password.value;
    const confirmPassword = signupForm.confirmPassword.value;

    if (password !== confirmPassword) {
      statusMessage.textContent = "Passwords do not match.";
      return;
    }

    try {
      statusMessage.textContent = "Creating account...";
      await window.Api.signup(username, password);
      statusMessage.textContent = "Signup successful. Redirecting to login...";
      setTimeout(() => {
        window.location.replace("/login.html");
      }, 800);
    } catch (error) {
      statusMessage.textContent = error.message;
    }
  });
});
