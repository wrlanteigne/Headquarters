// Keeps the app shell available offline. Network first, so updates show up right away.
const CACHE = 'hq-v17';
const SHELL = ['./', 'index.html', 'styles.css?v=16', 'config.js?v=16', 'plans.js?v=16', 'calc.js?v=16', 'tabs.js?v=16', 'app.js?v=16', 'ui.js?v=16', 'mail.js?v=16', 'calendar.js?v=16', 'docs.js?v=16', 'school.js?v=16', 'prefs.js?v=16', 'extras.js?v=16', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const req = e.request.mode === 'navigate' ? new Request(e.request.url, {cache: 'no-cache', credentials: 'same-origin'}) : new Request(e.request, {cache: 'no-cache'});
  e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
