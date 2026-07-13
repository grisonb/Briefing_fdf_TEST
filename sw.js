const CACHE_NAME = 'briefing-fdf-v2026-21-donnees-conservees';

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

async function fetchWithTimeout(request, options = {}, timeoutMs = 4000, waitForCompleteBody = false) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(request, { ...options, signal: controller.signal });
    // Pour les navigations et les PDF BFG, le délai couvre aussi le téléchargement du corps.
    // Sans cela, une connexion très mauvaise peut fournir les en-têtes puis rester bloquée indéfiniment.
    if (waitForCompleteBody && response.type !== 'opaque') {
      await response.clone().arrayBuffer();
    }
    return response;
  } finally {
    clearTimeout(timer);
  }
}

async function networkFirst(request, timeoutMs = 3500) {
  try {
    const networkRes = await fetchWithTimeout(request, { cache: 'no-store' }, timeoutMs, true);
    if (networkRes && networkRes.ok) {
      const cache = await caches.open(CACHE_NAME);
      cache.put(request, networkRes.clone()).catch(() => {});
    }
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

  const networkRes = await fetchWithTimeout(request, {}, 8000, true);
  if (networkRes && networkRes.ok) {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, networkRes.clone()).catch(() => {});
  }
  return networkRes;
}

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);

    try {
      const indexRes = await fetchWithTimeout(new Request('./index.html', { cache: 'no-store' }), {}, 6000, true);
      if (indexRes && indexRes.ok) await cache.put('./index.html', indexRes.clone());
    } catch (_) {
      // En réseau dégradé, reprendre l'ancienne copie avant de supprimer l'ancien cache.
      const previousIndex = await caches.match('./index.html');
      if (previousIndex) await cache.put('./index.html', previousIndex.clone());
    }

    for (const url of LOCAL_ASSETS) {
      try {
        const res = await fetchWithTimeout(new Request(url), {}, 8000, true);
        if (res && res.ok) await cache.put(url, res.clone());
      } catch (_) {
        const previousAsset = await caches.match(url);
        if (previousAsset) await cache.put(url, previousAsset.clone());
      }
    }

    self.skipWaiting();
  })());
});

function isMigratableBfgDataRequest(request) {
  try {
    const url = new URL(request.url);
    if (url.hostname !== 'grisonb.synology.me') return false;
    return (
      url.pathname.includes('/briefing-api/get-risk-map-pdf.php') ||
      url.pathname.includes('/briefing-api/get-risk-map-status.php') ||
      url.pathname.includes('/briefing-api/get-feuille-service-pdf.php') ||
      url.pathname.includes('/briefing-api/get-feuille-service-status.php') ||
      url.pathname.includes('/briefing-api/get-gaar-pdf.php') ||
      url.pathname.includes('/briefing-api/get-gaar-status.php') ||
      url.pathname.includes('/briefing-data/risk-maps/') ||
      url.pathname.includes('/briefing-data/feuille-service/') ||
      url.pathname.includes('/briefing-data/gaar/')
    );
  } catch (_) {
    return false;
  }
}

async function migratePreviousBfgDataCaches_() {
  const keys = await caches.keys();
  const target = await caches.open(CACHE_NAME);

  for (const key of keys) {
    if (key === CACHE_NAME || !key.startsWith('briefing-fdf')) continue;
    try {
      const source = await caches.open(key);
      const requests = await source.keys();
      for (const request of requests) {
        if (!isMigratableBfgDataRequest(request)) continue;
        const alreadyPresent = await target.match(request);
        if (alreadyPresent) continue;
        const response = await source.match(request);
        if (response) await target.put(request, response.clone());
      }
    } catch (_) {
      // Une entrée ancienne illisible ne doit pas bloquer l'activation.
    }
  }
}

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // v2026.21 : conserver les derniers PDF FDS/GAAR/risques lors d'une mise à jour
    // de l'application, puis seulement supprimer les anciens caches.
    await migratePreviousBfgDataCaches_();
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => (key === CACHE_NAME ? null : caches.delete(key))));
    await self.clients.claim();
  })());
});


function normalizedBfgCacheRequest(request) {
  try {
    const url = new URL(request.url);
    if (url.hostname !== 'grisonb.synology.me') return request;
    const stablePaths = [
      '/briefing-api/get-risk-map-pdf.php',
      '/briefing-api/get-risk-map-status.php',
      '/briefing-api/get-feuille-service-pdf.php',
      '/briefing-api/get-feuille-service-status.php',
      '/briefing-api/get-gaar-pdf.php',
      '/briefing-api/get-gaar-status.php'
    ];
    if (!stablePaths.some((p) => url.pathname.includes(p))) return request;
    const keep = new URL(url.origin + url.pathname);
    ['map', 'date'].forEach((key) => {
      const value = url.searchParams.get(key);
      if (value) keep.searchParams.set(key, value);
    });
    return new Request(keep.toString(), { method: 'GET' });
  } catch (_) {
    return request;
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  const sameOrigin = url.origin === self.location.origin;

  // Ressources externes spéciales stockées sur le NAS BFG.
  if (!sameOrigin && url.hostname === 'grisonb.synology.me' && (
      url.pathname.includes('/briefing-data/risk-maps/') ||
      url.pathname.includes('/briefing-data/gaar/') ||
      url.pathname.includes('/briefing-data/feuille-service/') ||
      url.pathname.includes('/briefing-data/temsi/') ||
      url.pathname.includes('/briefing-api/get-risk-map-pdf.php') ||
      url.pathname.includes('/briefing-api/get-risk-map-status.php') ||
      url.pathname.includes('/briefing-api/get-feuille-service-pdf.php') ||
      url.pathname.includes('/briefing-api/get-feuille-service-status.php') ||
      url.pathname.includes('/briefing-api/request-risk-map-generation.php') ||
      url.pathname.includes('/briefing-api/get-risk-map-generation-status.php') ||
      url.pathname.includes('/briefing-api/get-gaar-pdf.php') ||
      url.pathname.includes('/briefing-api/get-gaar-status.php') ||
      url.pathname.includes('/briefing-api/get-metar-taf.php')
    )) {
    event.respondWith((async () => {
      const normalizedRequest = normalizedBfgCacheRequest(event.request);
      try {
        const isLongGenerationRequest = url.pathname.includes('/briefing-api/request-risk-map-generation.php');
        const isPdfOrDataRequest =
          url.pathname.includes('/get-risk-map-pdf.php') ||
          url.pathname.includes('/get-feuille-service-pdf.php') ||
          url.pathname.includes('/get-gaar-pdf.php') ||
          url.pathname.includes('/briefing-data/risk-maps/') ||
          url.pathname.includes('/briefing-data/gaar/') ||
          url.pathname.includes('/briefing-data/feuille-service/');
        const timeoutMs = isLongGenerationRequest ? 65000 : (isPdfOrDataRequest ? 15000 : 5000);
        const networkRes = await fetchWithTimeout(event.request, { cache: 'no-store' }, timeoutMs, true);
        if (networkRes && networkRes.ok) {
          const cache = await caches.open(CACHE_NAME);
          cache.put(event.request, networkRes.clone()).catch(() => {});
          cache.put(normalizedRequest, networkRes.clone()).catch(() => {});
        }
        return networkRes;
      } catch (err) {
        const cached = await caches.match(event.request) || await caches.match(normalizedRequest);
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }

  // Ressource externe spéciale : TEMSI Météo-France.
  // Elle peut être mise en cache au moment de la sauvegarde pour un affichage hors ligne.
  if (!sameOrigin && url.hostname === 'aviation.meteo.fr' && url.pathname.includes('/affiche_image.php')) {
    event.respondWith((async () => {
      try {
        const networkRes = await fetchWithTimeout(event.request, {}, 10000, true);
        const cache = await caches.open(CACHE_NAME);
        cache.put(event.request, networkRes.clone()).catch(() => {});
        return networkRes;
      } catch (err) {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }

  // IMPORTANT GAAR/Leaflet/iPad :
  // Les autres ressources externes restent hors cache.
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
    event.respondWith(networkFirst(event.request, 3500));
    return;
  }

  event.respondWith(cacheFirst(event.request));
});
