const ACCOUNTS_API = "../Login/Database/api.php";

(async function enforceAdminSession() {
  try {
    const res = await fetch(`${ACCOUNTS_API}?action=checkSession`);
    const data = await res.json();
    if (!data.success || data.user.role !== "admin") {
      window.location.href = "../Login/Login.html";
    }
  } catch (err) {
    window.location.href = "../Login/Login.html";
  }
})();

const ROLE_LABEL = { menro: "MENRO", ranger: "Ranger", admin: "Administrator" };

function formatDate(dateStr) {
  const d = new Date(dateStr.replace(" ", "T"));
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function formatLastLogin(dateStr) {
  if (!dateStr) return "Never";
  return formatDate(dateStr);
}

const overlayCloseHandlers = new Map();

function bindOverlayDismiss(overlay, close, closeBtnId, cancelBtnId) {
  const closeBtn = document.getElementById(closeBtnId);
  if (closeBtn) closeBtn.addEventListener("click", close);

  if (cancelBtnId) {
    const cancelBtn = document.getElementById(cancelBtnId);
    if (cancelBtn) cancelBtn.addEventListener("click", close);
  }

  overlayCloseHandlers.set(overlay, close);
}

const accountsCache = { menro: [], ranger: [] };

async function loadAccounts() {
  try {
    const res = await fetch(`${ACCOUNTS_API}?action=list`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Failed to load accounts.");
    accountsCache.menro = data.accounts.menro || [];
    accountsCache.ranger = data.accounts.ranger || [];
    applyAccountFilter("menro");
    applyAccountFilter("ranger");
  } catch (err) {
    showDataWarning("Couldn't load accounts. Check that the server is reachable.");
  }
}

const sortState = {
  menro:  { field: "created_at", dir: "desc" },
  ranger: { field: "created_at", dir: "desc" },
};

function sortAccounts(accounts, field, dir) {
  const sorted = [...accounts].sort((a, b) => {
    const av = (a[field] || "").toString().toLowerCase();
    const bv = (b[field] || "").toString().toLowerCase();
    if (av < bv) return -1;
    if (av > bv) return 1;
    return 0;
  });
  if (dir === "desc") sorted.reverse();
  return sorted;
}

function updateSortHeaders(role) {
  const section = role === "menro" ? menroSection : rangerSection;
  const { field, dir } = sortState[role];
  section.querySelectorAll("th.sortable").forEach(th => {
    const isActive = th.dataset.sort === field;
    th.classList.toggle("sort-active", isActive);
    let arrow = th.querySelector(".sort-arrow");
    if (!arrow) {
      arrow = document.createElement("span");
      arrow.className = "sort-arrow";
      th.appendChild(arrow);
    }
    arrow.textContent = isActive ? (dir === "asc" ? "▲" : "▼") : "▲";
  });
}

document.querySelectorAll("th.sortable").forEach(th => {
  th.addEventListener("click", () => {
    const role = th.closest("#menroSection") ? "menro" : "ranger";
    const field = th.dataset.sort;
    const state = sortState[role];

    if (state.field === field) {
      state.dir = state.dir === "asc" ? "desc" : "asc";
    } else {
      state.field = field;
      state.dir = "asc";
    }

    updateSortHeaders(role);
    applyAccountFilter(role, true);
  });
});

const PAGE_SIZE = 10;
const currentPage = { menro: 1, ranger: 1 };

function applyAccountFilter(role, resetPage = false) {
  if (resetPage) currentPage[role] = 1;

  const searchEl = document.getElementById(role === "menro" ? "menroSearch" : "rangerSearch");
  const query = (searchEl?.value || "").trim().toLowerCase();
  const statusEl = document.getElementById(role === "menro" ? "menroStatusFilter" : "rangerStatusFilter");
  const statusValue = statusEl?.value || "all";
  const accounts = accountsCache[role] || [];

  let filtered = query
    ? accounts.filter(acc =>
        (acc.username || "").toLowerCase().includes(query) ||
        (acc.full_name || "").toLowerCase().includes(query) ||
        (acc.email || "").toLowerCase().includes(query)
      )
    : accounts;

  if (statusValue !== "all") {
    const wantActive = statusValue === "active";
    filtered = filtered.filter(acc => Boolean(Number(acc.is_active)) === wantActive);
  }

  const { field, dir } = sortState[role];
  const sorted = sortAccounts(filtered, field, dir);

  const countEl = document.getElementById(role === "menro" ? "menroCount" : "rangerCount");
  if (countEl) countEl.textContent = `(${sorted.length})`;

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  currentPage[role] = Math.min(currentPage[role], totalPages);
  const start = (currentPage[role] - 1) * PAGE_SIZE;
  const pageItems = sorted.slice(start, start + PAGE_SIZE);

  const isFiltered = query.length > 0 || statusValue !== "all";
  renderAccounts(role, pageItems, isFiltered);
  renderPagination(role, sorted.length, totalPages);
}

function renderPagination(role, totalCount, totalPages) {
  const pagination = document.getElementById(role === "menro" ? "menroPagination" : "rangerPagination");
  const text = document.getElementById(role === "menro" ? "menroPaginationText" : "rangerPaginationText");

  if (totalCount <= PAGE_SIZE) {
    pagination.hidden = true;
    return;
  }

  pagination.hidden = false;
  const page = currentPage[role];
  text.textContent = `Page ${page} of ${totalPages}`;

  const prev = document.getElementById(role === "menro" ? "menroPrevPage" : "rangerPrevPage");
  const next = document.getElementById(role === "menro" ? "menroNextPage" : "rangerNextPage");
  prev.disabled = page <= 1;
  next.disabled = page >= totalPages;
}

document.getElementById("menroPrevPage").addEventListener("click", () => {
  currentPage.menro = Math.max(1, currentPage.menro - 1);
  applyAccountFilter("menro");
});
document.getElementById("menroNextPage").addEventListener("click", () => {
  currentPage.menro += 1;
  applyAccountFilter("menro");
});
document.getElementById("rangerPrevPage").addEventListener("click", () => {
  currentPage.ranger = Math.max(1, currentPage.ranger - 1);
  applyAccountFilter("ranger");
});
document.getElementById("rangerNextPage").addEventListener("click", () => {
  currentPage.ranger += 1;
  applyAccountFilter("ranger");
});

document.getElementById("menroSearch").addEventListener("input", () => applyAccountFilter("menro", true));
document.getElementById("rangerSearch").addEventListener("input", () => applyAccountFilter("ranger", true));
document.getElementById("menroStatusFilter").addEventListener("change", () => applyAccountFilter("menro", true));
document.getElementById("rangerStatusFilter").addEventListener("change", () => applyAccountFilter("ranger", true));

const menroSection  = document.getElementById("menroSection");
const rangerSection = document.getElementById("rangerSection");

document.querySelectorAll(".account-tab").forEach(tab => {
  tab.addEventListener("click", () => {
    document.querySelectorAll(".account-tab").forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    const isMenro = tab.dataset.tab === "menro";
    menroSection.hidden = !isMenro;
    rangerSection.hidden = isMenro;
  });
});

function renderAccounts(role, accounts, isFiltered = false) {
  const body = document.getElementById(role === "menro" ? "menroAccountsBody" : "rangerAccountsBody");

  if (accounts.length === 0) {
    const message = isFiltered ? "No matching accounts." : `No ${ROLE_LABEL[role]} accounts yet.`;
    body.innerHTML = `<tr><td colspan="7" class="account-empty">${message}</td></tr>`;
    return;
  }

  body.innerHTML = accounts.map(acc => `
    <tr class="${Number(acc.is_active) ? "" : "row-inactive"}">
      <td>${escapeHtml(acc.full_name || "—")}</td>
      <td>${escapeHtml(acc.username)}</td>
      <td>${escapeHtml(acc.email || "—")}</td>
      <td>${escapeHtml(formatDate(acc.created_at))}</td>
      <td>${escapeHtml(formatLastLogin(acc.last_login))}</td>
      <td>
        <label class="status-toggle">
          <input type="checkbox" data-action="toggleActive" data-role="${role}" data-id="${acc.id}" data-username="${escapeHtml(acc.username)}" ${Number(acc.is_active) ? "checked" : ""}>
          <span class="status-toggle-track"></span>
          <span class="status-toggle-label">${Number(acc.is_active) ? "Active" : "Inactive"}</span>
        </label>
      </td>
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

async function setAccountActive(checkbox) {
  const { role, id, username } = checkbox.dataset;
  const active = checkbox.checked ? "1" : "0";
  checkbox.disabled = true;

  try {
    const res = await fetch(ACCOUNTS_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "setActive", role, id, active }),
    });
    const data = await res.json();

    if (data.success) {
      const cached = (accountsCache[role] || []).find(acc => String(acc.id) === String(id));
      if (cached) cached.is_active = checkbox.checked ? 1 : 0;
      const label = checkbox.closest(".status-toggle").querySelector(".status-toggle-label");
      label.textContent = checkbox.checked ? "Active" : "Inactive";
    } else {
      checkbox.checked = !checkbox.checked;
      showDataWarning(data.error || `Couldn't update the status for ${username}.`);
    }
  } catch (err) {
    checkbox.checked = !checkbox.checked;
    showDataWarning("Couldn't reach the server. Please try again.");
  } finally {
    checkbox.disabled = false;
  }
}

const VIEW_TITLE = {
  accountsView: "Accounts",
  timeLogView: "Time Log",
};

document.querySelectorAll(".nav-item[data-view]").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-item[data-view]").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    const viewId = btn.dataset.view;
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(viewId).classList.add("active");
    document.getElementById("topbarTitle").textContent = VIEW_TITLE[viewId] || "Accounts";

    if (viewId === "timeLogView") loadTimeLog();
  });
});

function formatTimeOnly(dateStr) {
  if (!dateStr) return "—";
  const d = new Date(dateStr.replace(" ", "T"));
  if (isNaN(d)) return "—";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

async function loadTimeLog() {
  const body = document.getElementById("timeLogBody");
  try {
    const res = await fetch(`${ACCOUNTS_API}?action=listTimeLog`);
    const data = await res.json();
    if (!data.success) throw new Error(data.error || "Failed to load time log.");
    renderTimeLog(data.entries || []);
  } catch (err) {
    body.innerHTML = `<tr><td colspan="6" class="account-empty">Couldn't load the time log.</td></tr>`;
  }
}

function renderTimeLog(entries) {
  const body = document.getElementById("timeLogBody");
  if (entries.length === 0) {
    body.innerHTML = `<tr><td colspan="6" class="account-empty">No check-ins recorded yet.</td></tr>`;
    return;
  }

  body.innerHTML = entries.map(entry => `
    <tr>
      <td>${escapeHtml(entry.actor_username)}</td>
      <td>${escapeHtml(entry.email || "—")}</td>
      <td>${escapeHtml(ROLE_LABEL[entry.actor_role] || entry.actor_role)}</td>
      <td>${escapeHtml(formatDate(entry.log_date))}</td>
      <td>${escapeHtml(formatTimeOnly(entry.time_in))}</td>
      <td>${escapeHtml(formatTimeOnly(entry.time_out))}</td>
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
      showDataWarning(`Reset link sent to ${username}.`);
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

  wrap.addEventListener("change", (e) => {
    const checkbox = e.target.closest('input[data-action="toggleActive"]');
    if (checkbox) handleToggleChange(checkbox);
  });
});

const deactivateOverlay = document.getElementById("deactivateOverlay");
const deactivateTargetLabel = document.getElementById("deactivateTargetLabel");
let deactivateTarget = null;

function handleToggleChange(checkbox) {
  if (checkbox.checked) {
    setAccountActive(checkbox);
    return;
  }

  checkbox.checked = true;
  deactivateTarget = checkbox;
  deactivateTargetLabel.textContent = `"${checkbox.dataset.username}" won't be able to sign in until reactivated.`;
  deactivateOverlay.classList.add("open");
}

function closeDeactivateModal() {
  deactivateOverlay.classList.remove("open");
  deactivateTarget = null;
}

bindOverlayDismiss(deactivateOverlay, closeDeactivateModal, "btnCloseDeactivate", "btnCancelDeactivate");

document.getElementById("btnConfirmDeactivate").addEventListener("click", () => {
  if (!deactivateTarget) return;
  const checkbox = deactivateTarget;
  closeDeactivateModal();
  checkbox.checked = false;
  setAccountActive(checkbox);
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
      showDataWarning(`Account "${username}" created.`);
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
      showDataWarning(`Account "${username}" updated.`);
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
  deleteTarget = { role, id, username };
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
  const { role, id, username } = deleteTarget;

  try {
    const res = await fetch(ACCOUNTS_API, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ action: "delete", role, id }),
    });
    const data = await res.json();

    closeDeleteModal();
    if (data.success) {
      loadAccounts();
      showDataWarning(`Account "${username}" deleted.`);
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

document.getElementById("btnConfirmSignout").addEventListener("click", async () => {
  try {
    await fetch(`${ACCOUNTS_API}?action=logout`, { method: "POST" });
  } catch (err) {
  }
  localStorage.removeItem("aquaguard_current_user");
  window.location.href = "../Login/Login.html";
});

document.querySelectorAll('button[data-action="togglePassword"]').forEach(btn => {
  btn.addEventListener("click", () => {
    const input = document.getElementById(btn.dataset.target);
    if (!input) return;
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    btn.setAttribute("aria-label", showing ? "Show password" : "Hide password");
  });
});

document.addEventListener("keydown", (e) => {
  if (e.key !== "Escape") return;
  const openOverlay = document.querySelector(".dashboard-overlay.open");
  if (!openOverlay) return;
  const close = overlayCloseHandlers.get(openOverlay);
  if (close) close();
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

updateSortHeaders("menro");
updateSortHeaders("ranger");
loadAccounts();
loadResetRequests();
