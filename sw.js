// Offline cache. Bump VERSION whenever any file changes so phones get the update.
const VERSION = 'van-v6';
const FILES = ['./', 'index.html', 'style.css', 'app.js', 'sheet.js', 'manifest.json', 'icon-192.png', 'icon-512.png',
  'fonts/manrope-latin.woff2', 'fonts/manrope-latin-ext.woff2', 'fonts/noto-sans-tamil.woff2'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so updates arrive when online), cache when offline.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(VERSION).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
