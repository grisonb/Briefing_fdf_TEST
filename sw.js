const CACHE_NAME = 'briefing-fdf-test-v3.24-import-auto-notams-pdf';

const LOCAL_ASSETS = [
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
  './tdf2026/supaip/SUP_AIP_ETAPE_3.pdf',
  './tdf2026/supaip/SUP_AIP_ETAPE_6.pdf',
  './tdf2026/supaip/SUP_AIP_ETAPE_17.pdf',
  './tdf2026/supaip/SUP_AIP_ETAPE_18.pdf',
  './tdf2026/supaip/SUP_AIP_ETAPE_19.pdf',
  './tdf2026/supaip/SUP_AIP_ETAPE_20.pdf'
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

    try {
      const indexRes = await fetch(new Request('./index.html', { cache: 'no-store' }));
      if (indexRes) await cache.put('./index.html', indexRes.clone());
    } catch (_) {}

    for (const url of LOCAL_ASSETS) {
      try {
        const res = await fetch(new Request(url));
        if (res) await cache.put(url, res.clone());
      } catch (_) {
        // Ignore les échecs ponctuels.
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
  const sameOrigin = url.origin === self.location.origin;

  // IMPORTANT GAAR/Leaflet/iPad :
  // On ne met plus en cache les ressources externes.
  // Leaflet, OpenStreetMap, CDNJS, UNPKG, CheckWX, Météo-France, Windy, etc.
  // passent directement au réseau.
  if (!sameOrigin) {
    event.respondWith(fetch(event.request));
    return;
  }

  const isNavigation = event.request.mode === 'navigate';
  const isIndex =
    url.pathname.endsWith('/index.html') ||
    url.pathname.endsWith('/Briefing_fdf_TEST/') ||
    url.pathname.endsWith('/Briefing-fdf/');

  if (isNavigation || isIndex) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
