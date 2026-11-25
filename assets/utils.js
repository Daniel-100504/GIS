let dataWarningHideTimer = null;

function showToast(message, variant = "warning") {
  let toastEl = document.getElementById("dataWarningToast");
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.id = "dataWarningToast";
    document.body.appendChild(toastEl);
  }
  toastEl.className = "data-warning-toast" + (variant === "success" ? " success" : "");
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(dataWarningHideTimer);
  dataWarningHideTimer = setTimeout(() => toastEl.classList.remove("show"), 5000);
}

function showDataWarning(message) {
  showToast(message, "warning");
}

function showDataSuccess(message) {
  showToast(message, "success");
}

function escapeHtml(value) {
  if (value === null || value === undefined) return "—";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function initIdleLogout(timeoutMinutes, onTimeout, options = {}) {
  const { warningSeconds = 30, overlayClass = "confirm-overlay" } = options;
  const timeoutMs = timeoutMinutes * 60 * 1000;
  const warningMs = Math.min(warningSeconds * 1000, timeoutMs);
  let idleTimer, countdownTimer, overlayEl;

  function clearTimers() {
    clearTimeout(idleTimer);
    clearInterval(countdownTimer);
  }

  function hideWarning() {
    if (overlayEl) { overlayEl.remove(); overlayEl = null; }
  }

  function logout() {
    clearTimers();
    hideWarning();
    onTimeout();
  }

  function showWarning() {
    let secondsLeft = Math.round(warningMs / 1000);

    overlayEl = document.createElement("div");
    overlayEl.className = `${overlayClass} open`;
    overlayEl.innerHTML = `
      <div class="confirm-modal">
        <div class="confirm-modal-icon" style="background:#fdf3e3;color:var(--moderate);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        </div>
        <h2 class="confirm-modal-title">Session timing out</h2>
        <p class="confirm-modal-text">You've been inactive. You'll be logged out in <strong id="idleCountdownValue">${secondsLeft}</strong>s.</p>
        <div class="confirm-modal-actions">
          <button type="button" class="btn-confirm-cancel" id="idleStayBtn">Stay logged in</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlayEl);

    const countEl = overlayEl.querySelector("#idleCountdownValue");
    countdownTimer = setInterval(() => {
      secondsLeft--;
      if (countEl) countEl.textContent = secondsLeft;
      if (secondsLeft <= 0) logout();
    }, 1000);

    overlayEl.querySelector("#idleStayBtn").addEventListener("click", reset);
  }

  function reset() {
    clearTimers();
    hideWarning();
    idleTimer = setTimeout(showWarning, timeoutMs - warningMs);
  }

  ["mousemove", "mousedown", "keydown", "scroll", "touchstart"].forEach(evt =>
    document.addEventListener(evt, () => { if (!overlayEl) reset(); }, { passive: true })
  );

  reset();
}

// Polls whether the current account is still active — an admin deactivating
// a ranger or MENRO officer mid-session doesn't touch their existing PHP
// session, so without this they'd stay fully logged in and working until it
// happened to expire on its own. `authApi` is that page's own auth endpoint
// ("Database/api.php" from ranger.php, "../../Login/Database/api.php" from
// satellite.php), since the two pages sit at different depths.
function initAccountStatusWatch(authApi, onDeactivated, pollSeconds = 20) {
  let shown = false;

  async function check() {
    if (shown) return;
    try {
      const res = await fetch(`${authApi}?action=checkSession`);
      const data = await res.json();
      if (!data.success && data.deactivated) {
        shown = true;
        clearInterval(timer);
        showDeactivatedNotice(onDeactivated);
      }
    } catch (err) {
      // A network hiccup shouldn't sign anyone out — just try again next tick.
    }
  }

  function showDeactivatedNotice(onContinue) {
    const overlayEl = document.createElement("div");
    overlayEl.className = "confirm-overlay open";
    overlayEl.style.zIndex = "99999";
    overlayEl.innerHTML = `
      <div class="confirm-modal">
        <div class="confirm-modal-icon" style="background:#fbeae7;color:var(--degraded);">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
        </div>
        <h2 class="confirm-modal-title">Your account has been deactivated</h2>
        <p class="confirm-modal-text">An administrator deactivated this account. You'll be returned to the login page.</p>
        <div class="confirm-modal-actions">
          <button type="button" class="btn-confirm-primary" id="deactivatedContinueBtn">Go to login</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlayEl);

    const goToLogin = () => onContinue();
    overlayEl.querySelector("#deactivatedContinueBtn").addEventListener("click", goToLogin);
    setTimeout(goToLogin, 6000);
  }

  const timer = setInterval(check, pollSeconds * 1000);
}
