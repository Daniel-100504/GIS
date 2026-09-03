const ACCOUNTS_API = "../Login/Database/api.php";

const ROLE_LABEL = { menro: "MENRO", ranger: "Ranger" };

function formatDate(dateStr) {
  const d = new Date(dateStr.replace(" ", "T"));
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function bindOverlayDismiss(overlay, close, closeBtnId, cancelBtnId) {
  const closeBtn = document.getElementById(closeBtnId);
  if (closeBtn) closeBtn.addEventListener("click", close);

  if (cancelBtnId) {
    const cancelBtn = document.getElementById(cancelBtnId);
    if (cancelBtn) cancelBtn.addEventListener("click", close);
  }

  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
}

async function loadAccounts() {
  try {
    const res = await fetch(`${ACCOUNTS_API}?action=list`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Failed to load accounts.");
    renderAccounts("menro", data.accounts.menro || []);
    renderAccounts("ranger", data.accounts.ranger || []);
  } catch (err) {
    showDataWarning("Couldn't load accounts. Check that the server is reachable.");
  }
}

function renderAccounts(role, accounts) {
  const body = document.getElementById(role === "menro" ? "menroAccountsBody" : "rangerAccountsBody");

  if (accounts.length === 0) {
    body.innerHTML = `<tr><td colspan="5" class="account-empty">No ${ROLE_LABEL[role]} accounts yet.</td></tr>`;
    return;
  }

  body.innerHTML = accounts.map(acc => `
    <tr>
      <td>${escapeHtml(acc.username)}</td>
      <td>${escapeHtml(acc.full_name || "—")}</td>
      <td>${escapeHtml(acc.email || "—")}</td>
      <td>${escapeHtml(formatDate(acc.created_at))}</td>
      <td>
        <div class="account-row-actions">
          <button class="btn-row-action" data-action="edit" data-role="${role}" data-id="${acc.id}" data-username="${escapeHtml(acc.username)}" data-full-name="${escapeHtml(acc.full_name || "")}" data-email="${escapeHtml(acc.email || "")}">Edit</button>
          <button class="btn-row-action" data-action="reset" data-role="${role}" data-id="${acc.id}" data-username="${escapeHtml(acc.username)}">Reset Password</button>
          <button class="btn-row-action danger" data-action="delete" data-role="${role}" data-id="${acc.id}" data-username="${escapeHtml(acc.username)}">Delete</button>
        </div>
      </td>
    </tr>
  `).join("");
}

const resetRequestsSection = document.getElementById("resetRequestsSection");
const resetRequestsHeading = document.getElementById("resetRequestsHeading");
const resetRequestsBody = document.getElementById("resetRequestsBody");

async function loadResetRequests() {
  try {
    const res = await fetch(`${ACCOUNTS_API}?action=listResetRequests`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Failed to load requests.");
    renderResetRequests(data.requests || []);
  } catch (err) {
    showDataWarning("Couldn't load password reset requests.");
  }
}

function renderResetRequests(requests) {
  if (requests.length === 0) {
    resetRequestsSection.hidden = true;
    return;
  }

  resetRequestsSection.hidden = false;
  resetRequestsHeading.textContent = `Password Reset Requests (${requests.length})`;

  resetRequestsBody.innerHTML = requests.map(req => {
    const canReset = req.role === "menro" || req.role === "ranger";
    const roleLabel = canReset ? ROLE_LABEL[req.role] : "Unknown account";

    let actionBtn = "";
    if (canReset && req.email) {
      actionBtn = `<button class="btn-row-action" data-action="approve" data-request-id="${req.id}" data-username="${escapeHtml(req.username)}">Send Reset Link</button>`;
    } else if (canReset) {
      actionBtn = `<button class="btn-row-action" data-action="reset" data-role="${req.role}" data-id="${req.account_id}" data-username="${escapeHtml(req.username)}" data-request-id="${req.id}">Reset Password</button>`;
    }

    return `
      <tr>
        <td>${escapeHtml(req.username)}</td>
        <td>${escapeHtml(roleLabel)}</td>
        <td>${escapeHtml(formatDate(req.requested_at))}</td>
        <td>
          <div class="account-row-actions">
            ${actionBtn}
            <button class="btn-row-action" data-action="dismiss" data-request-id="${req.id}">Dismiss</button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}

async function approveResetRequest(btn, requestId, username) {
  btn.disabled = true;
  btn.textContent = "Sending…";

  try {
    const res = await fetch(ACCOUNTS_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "approveResetRequest", requestId }),
    });
    const data = await res.json();

    if (data.success) {
      loadResetRequests();
    } else {
      showDataWarning(data.error || `Couldn't send the reset link to ${username}.`);
      btn.disabled = false;
      btn.textContent = "Send Reset Link";
    }
  } catch (err) {
    showDataWarning("Couldn't reach the server. Please try again.");
    btn.disabled = false;
    btn.textContent = "Send Reset Link";
  }
}

async function dismissResetRequest(requestId) {
  try {
    const res = await fetch(ACCOUNTS_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "dismissResetRequest", id: requestId }),
    });
    const data = await res.json();

    if (data.success) {
      loadResetRequests();
    } else {
      showDataWarning(data.error || "Couldn't dismiss the request.");
    }
  } catch (err) {
    showDataWarning("Couldn't reach the server. Please try again.");
  }
}

document.querySelectorAll(".account-table-wrap").forEach(wrap => {
  wrap.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-action]");
    if (!btn) return;

    const { action, role, id, username, requestId, fullName, email } = btn.dataset;
    if (action === "edit") openEditModal(role, id, username, fullName, email);
    if (action === "reset") openResetModal(role, id, username, requestId || null);
    if (action === "delete") openDeleteModal(role, id, username);
    if (action === "dismiss") dismissResetRequest(requestId);
    if (action === "approve") approveResetRequest(btn, requestId, username);
  });
});

const createOverlay    = document.getElementById("createOverlay");
const createForm       = document.getElementById("createForm");
const createModalTitle = document.getElementById("createModalTitle");
let createRole = null;

document.querySelectorAll(".btn-add").forEach(btn => {
  btn.addEventListener("click", () => {
    createRole = btn.dataset.role;
    createModalTitle.textContent = `Add ${ROLE_LABEL[createRole]} Account`;
    createForm.reset();
    createOverlay.classList.add("open");
  });
});

function closeCreateModal() {
  createOverlay.classList.remove("open");
}

bindOverlayDismiss(createOverlay, closeCreateModal, "btnCloseCreate", "btnCancelCreate");

createForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = document.getElementById("createUsername").value.trim();
  const fullName = document.getElementById("createFullName").value.trim();
  const email    = document.getElementById("createEmail").value.trim();
  const password = document.getElementById("createPassword").value;

  try {
    const res = await fetch(ACCOUNTS_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "create", role: createRole, username, fullName, email, password }),
    });
    const data = await res.json();

    if (data.success) {
      closeCreateModal();
      loadAccounts();
    } else {
      showDataWarning(data.error || "Couldn't create the account.");
    }
  } catch (err) {
    showDataWarning("Couldn't reach the server. Please try again.");
  }
});

const editOverlay = document.getElementById("editOverlay");
const editForm    = document.getElementById("editForm");
let editTarget = null;

function openEditModal(role, id, username, fullName, email) {
  editTarget = { role, id };
  document.getElementById("editUsername").value = username;
  document.getElementById("editFullName").value = fullName || "";
  document.getElementById("editEmail").value = email || "";
  editOverlay.classList.add("open");
}

function closeEditModal() {
  editOverlay.classList.remove("open");
  editTarget = null;
}

bindOverlayDismiss(editOverlay, closeEditModal, "btnCloseEdit", "btnCancelEdit");

editForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!editTarget) return;

  const username = document.getElementById("editUsername").value.trim();
  const fullName = document.getElementById("editFullName").value.trim();
  const email    = document.getElementById("editEmail").value.trim();

  try {
    const res = await fetch(ACCOUNTS_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "update", role: editTarget.role, id: editTarget.id, username, fullName, email }),
    });
    const data = await res.json();

    if (data.success) {
      closeEditModal();
      loadAccounts();
    } else {
      showDataWarning(data.error || "Couldn't save the changes.");
    }
  } catch (err) {
    showDataWarning("Couldn't reach the server. Please try again.");
  }
});

const resetOverlay     = document.getElementById("resetOverlay");
const resetForm        = document.getElementById("resetForm");
const resetTargetLabel = document.getElementById("resetTargetLabel");
let resetTarget = null;

function openResetModal(role, id, username, requestId = null) {
  resetTarget = { role, id, requestId };
  resetTargetLabel.textContent = `Set a new password for "${username}".`;
  resetForm.reset();
  resetOverlay.classList.add("open");
}

function closeResetModal() {
  resetOverlay.classList.remove("open");
  resetTarget = null;
}

bindOverlayDismiss(resetOverlay, closeResetModal, "btnCloseReset", "btnCancelReset");

resetForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!resetTarget) return;

  const password = document.getElementById("resetPassword").value;

  try {
    const body = { action: "resetPassword", role: resetTarget.role, id: resetTarget.id, password };
    if (resetTarget.requestId) body.requestId = resetTarget.requestId;

    const res = await fetch(ACCOUNTS_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body),
    });
    const data = await res.json();

    if (data.success) {
      closeResetModal();
      loadResetRequests();
    } else {
      showDataWarning(data.error || "Couldn't reset the password.");
    }
  } catch (err) {
    showDataWarning("Couldn't reach the server. Please try again.");
  }
});

const deleteOverlay = document.getElementById("deleteOverlay");
const deleteTargetLabel = document.getElementById("deleteTargetLabel");
let deleteTarget = null;

function openDeleteModal(role, id, username) {
  deleteTarget = { role, id };
  deleteTargetLabel.textContent = `This will permanently delete the account "${username}".`;
  deleteOverlay.classList.add("open");
}

function closeDeleteModal() {
  deleteOverlay.classList.remove("open");
  deleteTarget = null;
}

bindOverlayDismiss(deleteOverlay, closeDeleteModal, "btnCloseDelete", "btnCancelDelete");

document.getElementById("btnConfirmDelete").addEventListener("click", async () => {
  if (!deleteTarget) return;

  try {
    const res = await fetch(ACCOUNTS_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "delete", role: deleteTarget.role, id: deleteTarget.id }),
    });
    const data = await res.json();

    closeDeleteModal();
    if (data.success) {
      loadAccounts();
    } else {
      showDataWarning(data.error || "Couldn't delete the account.");
    }
  } catch (err) {
    closeDeleteModal();
    showDataWarning("Couldn't reach the server. Please try again.");
  }
});

const signoutOverlay = document.getElementById("signoutOverlay");
const btnSignOut     = document.getElementById("btnSignOut");

function openSignoutConfirm() { signoutOverlay.classList.add("open"); }
function closeSignoutConfirm() { signoutOverlay.classList.remove("open"); }

btnSignOut.addEventListener("click", openSignoutConfirm);
bindOverlayDismiss(signoutOverlay, closeSignoutConfirm, "btnCloseSignout", "btnCancelSignout");

document.getElementById("btnConfirmSignout").addEventListener("click", () => {
  localStorage.removeItem("aquaguard_current_user");
  window.location.href = "../Login/Login.html";
});

(function displayLoggedInUser() {
  const nameEl = document.getElementById("adminName");
  const avatarEl = document.getElementById("adminAvatar");
  if (!nameEl || !avatarEl) return;

  try {
    const stored = localStorage.getItem("aquaguard_current_user");
    if (!stored) return;

    const user = JSON.parse(stored);
    const displayName = user.fullName || user.username;
    if (!displayName) return;

    nameEl.textContent = displayName;
    avatarEl.textContent = displayName.charAt(0).toUpperCase();
  } catch (err) {
  }
})();

(function () {
  const dateEl = document.getElementById("topbar-date");
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString("en-PH", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
  }
})();

(function () {
  const canvas = document.getElementById("gisCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const gridSpacing = 48;
    ctx.strokeStyle = "rgba(20, 107, 82, 0.05)";
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSpacing) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    const cx = canvas.width * 0.8;
    const cy = canvas.height * 0.2;
    ctx.strokeStyle = "rgba(20, 107, 82, 0.04)";
    for (let r = 60; r < 260; r += 45) {
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    draw();
  }

  window.addEventListener("resize", resize);
  resize();
})();

loadAccounts();
loadResetRequests();
