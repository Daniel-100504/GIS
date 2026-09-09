let dataWarningHideTimer = null;

function showDataWarning(message) {
  let toastEl = document.getElementById("dataWarningToast");
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.id = "dataWarningToast";
    toastEl.className = "data-warning-toast";
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = message;
  toastEl.classList.add("show");
  clearTimeout(dataWarningHideTimer);
  dataWarningHideTimer = setTimeout(() => toastEl.classList.remove("show"), 5000);
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
        <p class="confirm-modal-text">You've been inactive. You'll be signed out in <strong id="idleCountdownValue">${secondsLeft}</strong>s.</p>
        <div class="confirm-modal-actions">
          <button type="button" class="btn-confirm-cancel" id="idleStayBtn">Stay signed in</button>
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
