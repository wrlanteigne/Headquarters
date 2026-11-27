// Keeps the app shell available offline. Network first, so updates show up right away.
const CACHE = 'hq-v16';
const SHELL = ['./', 'index.html', 'styles.css?v=15', 'config.js?v=15', 'plans.js?v=15', 'calc.js?v=15', 'tabs.js?v=15', 'app.js?v=15', 'ui.js?v=15', 'mail.js?v=15', 'calendar.js?v=15', 'docs.js?v=15', 'school.js?v=15', 'prefs.js?v=15', 'extras.js?v=15', 'manifest.webmanifest', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  const req = e.request.mode === 'navigate' ? new Request(e.request.url, {cache: 'no-cache', credentials: 'same-origin'}) : new Request(e.request, {cache: 'no-cache'});
  e.respondWith(fetch(req).then((r) => { const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return r; }).catch(() => caches.match(e.request)));
});
