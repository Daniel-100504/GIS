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

function bindPasswordToggle(toggleBtnId, inputId, eyeIconId) {
  const toggleBtn = document.getElementById(toggleBtnId);
  const input = document.getElementById(inputId);
  const eyeIcon = document.getElementById(eyeIconId);
  if (!toggleBtn || !input || !eyeIcon) return;

  toggleBtn.addEventListener("click", () => {
    if (input.type === "password") {
      input.type = "text";
      eyeIcon.innerHTML = `
        <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/>
        <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/>
        <line x1="1" y1="1" x2="23" y2="23"/>
      `;
    } else {
      input.type = "password";
      eyeIcon.innerHTML = `
        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
        <circle cx="12" cy="12" r="3"/>
      `;
    }
  });
}

bindPasswordToggle("toggleNewPassword", "newPassword", "newPasswordEyeIcon");
bindPasswordToggle("toggleConfirmPassword", "confirmPassword", "confirmPasswordEyeIcon");

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
