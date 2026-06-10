const CACHE_NAME = 'briefing-fdf-test-v2.4-pwa-tdf2026-gaar-cache';
const CORE_ASSETS = [
  './manifest.json',
  './icons/icon-180.png',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './tdf2026/stage01.jpg',
  './tdf2026/stage02.jpg',
  './tdf2026/stage03.jpg',
  './tdf2026/stage04.jpg',
  './tdf2026/stage05.jpg',
  './tdf2026/stage06.jpg',
  './tdf2026/stage07.jpg',
  './tdf2026/stage08.jpg',
  './tdf2026/stage09.jpg',
  './tdf2026/stage10.jpg',
  './tdf2026/stage11.jpg',
  './tdf2026/stage12.jpg',
  './tdf2026/stage13.jpg',
  './tdf2026/stage14.jpg',
  './tdf2026/stage15.jpg',
  './tdf2026/stage16.jpg',
  './tdf2026/stage17.jpg',
  './tdf2026/stage18.jpg',
  './tdf2026/stage19.jpg',
  './tdf2026/stage20.jpg',
  './tdf2026/stage21.jpg',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://unpkg.com/leaflet@1.9.3/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.3/dist/leaflet.js'
];

async function networkFirst(request) {
  try {
    const networkRes = await fetch(request, { cache: 'no-store' });
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkRes.clone()).catch(() => {});
    return networkRes;
  } catch (err) {
    const cached = await caches.match(request);
    if (cached) return cached;
    const fallback = await caches.match('./index.html');
    if (fallback) return fallback;
    throw err;
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;

  const networkRes = await fetch(request);
  const cache = await caches.open(CACHE_NAME);
  cache.put(request, networkRes.clone()).catch(() => {});
  return networkRes;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    // On garde index.html en cache uniquement comme secours offline,
    // mais les navigations le demanderont d'abord au réseau.
    try {
      const indexRes = await fetch(new Request('./index.html', { cache: 'no-store' }));
      if (indexRes) await cache.put('./index.html', indexRes.clone());
    } catch (_) {}

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

  const url = new URL(event.request.url);

  // Important : l'application HTML doit toujours être demandée au réseau d'abord.
  // Cela évite de rester bloqué sur une ancienne version qui casse Leaflet/GAAR.
  const isNavigation = event.request.mode === 'navigate';
  const isIndex = url.pathname.endsWith('/index.html') || url.pathname.endsWith('/Briefing_fdf_TEST/') || url.pathname.endsWith('/Briefing-fdf/');

  if (isNavigation || isIndex) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
