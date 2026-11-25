// Site-wide service worker — lets the whole system (Login, Admin, MENRO,
// Ranger) open as one installed app, even with no signal. Network-first,
// cache as fallback: always fetches the latest version when there's a
// connection, and only falls back to the last-cached copy when a fetch
// genuinely fails. Never cache-first — that would mean re-editing this
// file's own list every time a page's own cache-buster version changes
// elsewhere, and would risk serving a stale copy while online.
//
// A ranger submitting a survey with no signal is handled separately, by
// that app's own localStorage queue in ranger/field-survey.js — this file
// only makes sure the *pages themselves* can still open with no signal, so
// that queue (and the rest of each role's dashboard) is reachable at all.

const CACHE_NAME = 'aquaguard-shell-v1';

const PRECACHE_URLS = [
  './Login/Login.php',
  './manifest.json',
  './assets/aquaguard-logo.png',
  './assets/aquaguard-logo-app.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Never intercept a write (form submit, API POST) — those go straight to
  // the network exactly as before, and each app's own code already handles
  // a failed one (e.g. the ranger offline queue).
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Leave cross-origin requests (Google Fonts, Leaflet's CDN, Supabase)
  // alone — only this app's own same-origin files are cached here.
  if (url.origin !== self.location.origin) return;

  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match('./Login/Login.php'))
      )
  );
});
