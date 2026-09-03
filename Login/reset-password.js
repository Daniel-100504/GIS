const RESET_API = "Database/api.php";

const loadingView = document.getElementById("loadingView");
const invalidView = document.getElementById("invalidView");
const formView = document.getElementById("formView");
const successView = document.getElementById("successView");

function showView(view) {
  [loadingView, invalidView, formView, successView].forEach(v => v.hidden = true);
  view.hidden = false;
}

const params = new URLSearchParams(window.location.search);
const token = params.get("token") || "";

async function validateToken() {
  if (!token) {
    showView(invalidView);
    return;
  }

  try {
    const res = await fetch(`${RESET_API}?action=validateToken&token=${encodeURIComponent(token)}`);
    const data = await res.json();

    if (data.success) {
      document.getElementById("resetUsername").textContent = data.username;
      showView(formView);
    } else {
      document.getElementById("invalidMsg").textContent = data.error || "This password reset link is no longer valid.";
      showView(invalidView);
    }
  } catch (err) {
    document.getElementById("invalidMsg").textContent = "Couldn't reach the server. Please try again.";
    showView(invalidView);
  }
}

document.getElementById("resetForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const password = document.getElementById("newPassword").value;
  const confirm = document.getElementById("confirmPassword").value;
  const errorMsg = document.getElementById("resetErrorMsg");
  errorMsg.textContent = "";

  if (password.length < 8) {
    errorMsg.textContent = "Password must be at least 8 characters.";
    return;
  }
  if (password !== confirm) {
    errorMsg.textContent = "Passwords do not match.";
    return;
  }

  try {
    const res = await fetch(RESET_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "setPassword", token, password }),
    });
    const data = await res.json();

    if (data.success) {
      showView(successView);
    } else {
      errorMsg.textContent = data.error || "Couldn't reset the password.";
    }
  } catch (err) {
    errorMsg.textContent = "Couldn't reach the server. Please try again.";
  }
});

validateToken();
