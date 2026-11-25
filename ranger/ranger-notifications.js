// Notifies a ranger when MENRO reviews one of their submissions (approved or
// sent back for revision). Unlike MENRO's own bell (notifications.js, which
// just flags "new submissions" client-side from localStorage), these are
// real rows from ranger_notifications — MENRO's review action on the server
// is what creates them, so they persist and survive a refresh or new device.
const NOTIF_API = '../Menro/API/ranger-notifications.php';

function escapeNotifHtml(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

// Same title + "Zone · Date" subtitle shape as MENRO's own bell
// (notifications.js's renderNotifItem) instead of one long merged sentence.
// Unread ones get the same Facebook-style tinted background as MENRO's bell
// now does too — cleared the moment this one is clicked.
function renderRangerNotifItem(n) {
  const zone = n.zoneName || 'Unknown zone';
  const date = n.inspectionDate || '—';
  const noteLine = n.notes ? `<div class="notif-item-sub notif-item-note">"${escapeNotifHtml(n.notes)}"</div>` : '';
  return `
    <button type="button" class="notif-item${n.isRead ? '' : ' unread'}" data-kobo-id="${escapeNotifHtml(n.koboId)}" data-notif-id="${escapeNotifHtml(n.id)}">
      <div class="notif-item-title">${escapeNotifHtml(n.message)}</div>
      <div class="notif-item-sub">${escapeNotifHtml(zone)} · ${escapeNotifHtml(date)}</div>
      ${noteLine}
    </button>
  `;
}

// A second, purely local notification source — for events that only ever
// happen on this one device (an offline survey finally syncing) and have no
// server-side row to fetch. Merged into the same bell/list as the real
// ranger_notifications ones below, so there's one notification experience
// instead of two separate places to check.
const LOCAL_NOTIF_KEY = 'aquaguard_local_notifications';

function getLocalNotifications() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_NOTIF_KEY) || '[]');
  } catch (err) {
    return [];
  }
}

function setLocalNotifications(list) {
  try {
    localStorage.setItem(LOCAL_NOTIF_KEY, JSON.stringify(list));
  } catch (err) {
    // Storage unavailable — the notification just won't persist, not fatal.
  }
}

// Called from field-survey.js the moment a queued offline survey actually
// makes it to the server.
window.addLocalRangerNotification = function (message) {
  const list = getLocalNotifications();
  list.unshift({ id: 'local-' + Date.now(), message, createdAt: new Date().toISOString(), isRead: false });
  setLocalNotifications(list.slice(0, 30)); // keep this from growing forever
  loadRangerNotifications();
};

function renderLocalNotifItem(n) {
  const date = new Date(n.createdAt);
  const dateLabel = isNaN(date.getTime())
    ? ''
    : `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  return `
    <button type="button" class="notif-item${n.isRead ? '' : ' unread'}" data-local-id="${escapeNotifHtml(n.id)}">
      <div class="notif-item-title">${escapeNotifHtml(n.message)}</div>
      <div class="notif-item-sub">${escapeNotifHtml(dateLabel)}</div>
    </button>
  `;
}

// The 20s poll (bottom of this file) and a click's own refresh can both be
// in flight at once; if the poll started first but resolves second, its
// (now-stale) unread data would otherwise overwrite the click's fresher
// render. Each call stamps its own generation and only the most recent one
// is allowed to paint the list, so an out-of-order response is just dropped.
let notifRenderGeneration = 0;

async function loadRangerNotifications() {
  const countEl = document.getElementById('notifCount');
  const listEl = document.getElementById('notifList');
  if (!countEl || !listEl) return;

  const thisGeneration = ++notifRenderGeneration;
  // The local (offline-sync) notifications are read regardless of whether
  // the server fetch below succeeds — a ranger checking the bell while
  // offline should still see those, not just whatever was already on screen.
  const localItems = getLocalNotifications();
  let serverItems = [];
  try {
    const res = await fetch(NOTIF_API, { credentials: 'same-origin' });
    if (res.ok) {
      const data = await res.json();
      serverItems = Array.isArray(data.results) ? data.results : [];
    }
  } catch (err) {
    // No connection — just show whatever local notifications there are.
  }
  if (thisGeneration !== notifRenderGeneration) return;

  const unreadCount = serverItems.filter(n => !n.isRead).length + localItems.filter(n => !n.isRead).length;
  if (unreadCount > 0) {
    countEl.hidden = false;
    countEl.textContent = unreadCount > 99 ? '99+' : String(unreadCount);
  } else {
    countEl.hidden = true;
  }

  const html = localItems.map(renderLocalNotifItem).join('') + serverItems.map(renderRangerNotifItem).join('');
  listEl.innerHTML = html || '<div class="notif-empty">No notifications yet</div>';
}

async function markNotificationRead(id) {
  try {
    const body = new URLSearchParams({ action: 'markRead', id: String(id) });
    const res = await fetch(NOTIF_API, { method: 'POST', credentials: 'same-origin', body });
    return res.ok;
  } catch (err) {
    // Best-effort — a failed mark-read just means it shows unread again next poll.
    return false;
  }
}

function bindRangerNotifications() {
  const wrap = document.getElementById('notifWrap');
  const btn = document.getElementById('notifBtn');
  const panel = document.getElementById('notifPanel');
  const listEl = document.getElementById('notifList');
  const clearBtn = document.getElementById('notifClearBtn');
  if (!wrap || !btn || !panel) return;

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = wrap.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(isOpen));
  });

  panel.addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) {
      wrap.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');
    }
  });

  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      await markNotificationRead('all');
      setLocalNotifications(getLocalNotifications().map((n) => ({ ...n, isRead: true })));
      loadRangerNotifications();
    });
  }

  if (listEl) {
    listEl.addEventListener('click', (e) => {
      const localItem = e.target.closest('.notif-item[data-local-id]');
      if (localItem) {
        const localId = localItem.getAttribute('data-local-id');
        setLocalNotifications(
          getLocalNotifications().map((n) => (n.id === localId ? { ...n, isRead: true } : n))
        );
        loadRangerNotifications();
        return;
      }

      const item = e.target.closest('.notif-item[data-kobo-id]');
      if (!item) return;
      wrap.classList.remove('open');
      btn.setAttribute('aria-expanded', 'false');

      // Clear the highlight immediately rather than waiting on the network
      // — the click already answers "have I seen this", so there's nothing
      // to gain by waiting for a round trip to say so back to the same tab.
      const wasUnread = item.classList.contains('unread');
      if (wasUnread) {
        item.classList.remove('unread');
        const countEl = document.getElementById('notifCount');
        if (countEl && !countEl.hidden) {
          const remaining = Math.max(0, (parseInt(countEl.textContent, 10) || 1) - 1);
          if (remaining > 0) countEl.textContent = String(remaining);
          else countEl.hidden = true;
        }
      }

      const notifId = item.getAttribute('data-notif-id');
      const koboId = item.getAttribute('data-kobo-id');
      if (typeof window.openSubmissionViewByKoboId === 'function') {
        window.openSubmissionViewByKoboId(koboId);
      }
      if (wasUnread) markNotificationRead(notifId);
    });
  }
}

bindRangerNotifications();
loadRangerNotifications();
setInterval(loadRangerNotifications, 20000);
