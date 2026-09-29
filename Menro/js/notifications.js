// Notifies MENRO staff when ranger field submissions are added or edited,
// using a bell icon + dropdown in the top bar. Kobo's own submission id
// (_id) only ever goes up, so a brand-new submission is easy to catch, but
// an edit (made through AquaGuard's own edit feature) keeps the same _id —
// so "seen" is tracked per submission as an id+version signature instead of
// a single highest-id watermark, letting both adds and edits show up as new.
const NOTIF_SEEN_KEY = "aquaguard_menro_seen_submission_versions";

// How many recent submissions the bell shows at once — read ones stay
// visible (just unhighlighted) instead of disappearing the moment they're
// seen, the same way a Facebook notification stays in the list after you've
// opened it.
const NOTIF_LIST_LIMIT = 20;

function getSubmissionKoboId(sub) {
  return parseInt(sub && sub["_id"], 10) || 0;
}

// A submission's "version" changes when it's edited (edited_at moves
// forward); an unedited submission's version is just its own id.
function getSubmissionVersion(sub) {
  return sub && sub["_edited_at"] ? String(sub["_edited_at"]) : "new";
}

function getSubmissionSignature(sub) {
  return `${getSubmissionKoboId(sub)}:${getSubmissionVersion(sub)}`;
}

function getNotifSeenSignatures() {
  try {
    const stored = localStorage.getItem(NOTIF_SEEN_KEY);
    return stored ? new Set(JSON.parse(stored)) : null;
  } catch (err) {
    return null;
  }
}

function setNotifSeenSignatures(signatures) {
  localStorage.setItem(NOTIF_SEEN_KEY, JSON.stringify([...signatures]));
}

function prettifyNotifValue(raw) {
  if (!raw) return "—";
  return String(raw).replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function renderNotifItem(sub, isUnread) {
  const ranger = sub["Ranger_Name"] || "A ranger";
  const barangay = sub["_zone_name"] || prettifyNotifValue(sub["Protected_area_Zone"] || sub["Barangay"]);
  const date = sub["Inspection_Date"] || sub["Date_of_visit"] || (sub["_submission_time"] || "").slice(0, 10) || "—";
  const isEdit = !!sub["_locally_edited"];
  const action = isEdit ? "updated a survey" : "submitted a new survey";
  return `
    <button type="button" class="notif-item${isUnread ? " unread" : ""}" data-kobo-id="${escapeHtml(String(getSubmissionKoboId(sub)))}">
      <div class="notif-item-title">${escapeHtml(ranger)} ${escapeHtml(action)}</div>
      <div class="notif-item-sub">${escapeHtml(barangay)} · ${escapeHtml(date)}</div>
    </button>
  `;
}

function renderNotifications() {
  const countEl = document.getElementById("notifCount");
  const listEl = document.getElementById("notifList");
  if (!countEl || !listEl) return;

  const submissions = typeof ALL_SUBMISSIONS !== "undefined" ? ALL_SUBMISSIONS : [];
  // Every survey submitted through AquaGuard's own form (not Kobo) is given
  // a negative id — only an actual Kobo submission is missing/zero here, so
  // this must exclude 0, not every id that isn't positive.
  const validSubs = submissions.filter(sub => getSubmissionKoboId(sub) !== 0);

  let seen = getNotifSeenSignatures();
  if (seen === null) {
    // First time this feature has run in this browser — treat everything
    // already submitted as already seen, so it doesn't flood in as "new".
    seen = new Set(validSubs.map(getSubmissionSignature));
    setNotifSeenSignatures(seen);
  }

  const sorted = [...validSubs].sort((a, b) => {
    const aTime = a["_edited_at"] || a["_submission_time"] || "";
    const bTime = b["_edited_at"] || b["_submission_time"] || "";
    return bTime.localeCompare(aTime) || (getSubmissionKoboId(b) - getSubmissionKoboId(a));
  });

  const unreadCount = sorted.filter(sub => !seen.has(getSubmissionSignature(sub))).length;
  if (unreadCount > 0) {
    countEl.hidden = false;
    countEl.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
  } else {
    countEl.hidden = true;
  }

  const visible = sorted.slice(0, NOTIF_LIST_LIMIT);
  listEl.innerHTML = visible.length
    ? visible.map(sub => renderNotifItem(sub, !seen.has(getSubmissionSignature(sub)))).join("")
    : '<div class="notif-empty">No submissions yet</div>';
}

function markAllNotificationsRead() {
  const submissions = typeof ALL_SUBMISSIONS !== "undefined" ? ALL_SUBMISSIONS : [];
  const validSubs = submissions.filter(sub => getSubmissionKoboId(sub) !== 0);
  setNotifSeenSignatures(new Set(validSubs.map(getSubmissionSignature)));
  renderNotifications();
}

// Clicking one notification only marks that submission's own signature as
// seen (not the whole list), then switches to the Ranger Surveys tab and
// opens the same submission-detail popup used from that tab's table, so
// "click a notification, land on the survey" works the same way it does
// on the ranger side.
async function openNotificationSubmission(koboId) {
  const submissions = typeof ALL_SUBMISSIONS !== "undefined" ? ALL_SUBMISSIONS : [];
  const sub = submissions.find(s => getSubmissionKoboId(s) === koboId);
  if (!sub) return;

  const seen = getNotifSeenSignatures() || new Set();
  seen.add(getSubmissionSignature(sub));
  setNotifSeenSignatures(seen);
  renderNotifications();

  if (typeof openSurveys === "function") await openSurveys();
  if (typeof openSubmissionDetailModal === "function") openSubmissionDetailModal(sub);
}

function bindNotifications() {
  const wrap = document.getElementById("notifWrap");
  const btn = document.getElementById("notifBtn");
  const panel = document.getElementById("notifPanel");
  const listEl = document.getElementById("notifList");
  const clearBtn = document.getElementById("notifClearBtn");
  if (!wrap || !btn || !panel) return;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = wrap.classList.toggle("open");
    btn.setAttribute("aria-expanded", String(isOpen));
  });

  panel.addEventListener("click", (e) => e.stopPropagation());

  document.addEventListener("click", (e) => {
    if (!wrap.contains(e.target)) {
      wrap.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    }
  });

  if (clearBtn) clearBtn.addEventListener("click", markAllNotificationsRead);

  if (listEl) {
    listEl.addEventListener("click", (e) => {
      const item = e.target.closest(".notif-item[data-kobo-id]");
      if (!item) return;
      wrap.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
      openNotificationSubmission(parseInt(item.dataset.koboId, 10));
    });
  }
}

bindNotifications();

// ui-chrome.js's initWithKobo() fetches the real submission list right after
// this script loads, but that fetch is still in flight at this point —
// rendering immediately would run against an empty ALL_SUBMISSIONS and
// permanently mark "seen" as empty, so every real submission would then
// look new forever. Wait for the app's own dataReady flag first.
function renderNotificationsWhenReady() {
  if (typeof dataReady !== "undefined" && dataReady) {
    renderNotifications();
  } else {
    setTimeout(renderNotificationsWhenReady, 200);
  }
}
renderNotificationsWhenReady();

// The rest of the app only re-fetches submissions on page load or after
// reconnecting from being offline. Poll here too so new field reports
// actually show up as notifications while a MENRO staff member has the
// page open, instead of only appearing after a manual refresh.
setInterval(async () => {
  if (typeof fetchKoboData === "function") await fetchKoboData();
  renderNotifications();
}, 30 * 1000);
