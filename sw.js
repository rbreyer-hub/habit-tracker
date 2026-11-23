// Firebase Cloud Messaging: the server sends data-only pushes; we display them here so they show when the app is closed.
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.0/firebase-messaging-compat.js');
importScripts('firebase-config.js'); // initializes the app
firebase.messaging().onBackgroundMessage(p => {
  const d = p.data || {};
  return self.registration.showNotification(d.title || 'Habit Tracker', { body: d.body || '', tag: d.tag, icon: 'icon.svg', badge: 'icon.svg' });
});

const CACHE = 'habits-v19';
const FILES = ['./', 'index.html', 'app.js?v=17', 'sync.js?v=3', 'push.js?v=1', 'timer.js?v=2', 'update.js?v=1', 'firebase-config.js', 'manifest.json', 'icon.svg'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener('activate', e => e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))));
self.addEventListener('fetch', e => {
  if (new URL(e.request.url).origin !== location.origin) return;
  // Network first, revalidating with the server every time (cache: 'no-cache' sends a cheap
  // If-None-Match). A plain fetch() honours GitHub Pages' max-age=600 and can hand back a stale page.
  // Offline: fall back to the cached copy (navigations ignore ?v= cache-busting query strings).
  const nav = e.request.mode === 'navigate';
  // (A navigate-mode Request can't be re-fetched with options, so navigations are fetched by URL.)
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(nav ? e.request.url : e.request, { cache: 'no-cache' }).catch(() =>
    caches.match(e.request, { ignoreSearch: nav }).then(r => r || (nav ? caches.match('index.html') : r))));
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(l => l.length ? l[0].focus() : clients.openWindow('./')));
});
