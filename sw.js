const CACHE_NAME = 'briefing-fdf-v0.35';
const CORE_ASSETS = [
  './',
  './index.html',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://unpkg.com/leaflet@1.9.3/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.3/dist/leaflet.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    for (const url of CORE_ASSETS) {
      try {
        const isCrossOrigin = /^https?:\/\//.test(url);
        const req = isCrossOrigin ? new Request(url, { mode: 'no-cors' }) : new Request(url);
        const res = await fetch(req);
        if (res) await cache.put(url, res.clone());
      } catch (_) {
        // Ignore les échecs ponctuels; le runtime mettra en cache au fur et à mesure.
      }
    }
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key))));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) return cached;
    try {
      const networkRes = await fetch(event.request);
      const cache = await caches.open(CACHE_NAME);
      cache.put(event.request, networkRes.clone()).catch(() => {});
      return networkRes;
    } catch (err) {
      const fallback = await caches.match('./index.html');
      if (fallback && event.request.mode === 'navigate') return fallback;
      throw err;
    }
  })());
});
