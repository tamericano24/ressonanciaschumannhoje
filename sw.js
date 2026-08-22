/* Service worker aprimorado com caching estratégico
   ============================================================================

   Estratégia de caching:
   - Assets estáticos (HTML, CSS, JS, imagens, fontes): Cache-first
   - Dados ao vivo (APIs, JSON de dados): Network-first
   - Navigation requests: Network-first com fallback para cache
   - Terceiros: Network-only

   Versão do cache: ressonancia-static-v1
   ============================================================================ */

const CACHE_NAME = 'ressonancia-static-v1';
const DATA_CACHE_NAME = 'ressonancia-data-v1';

const FILES_TO_CACHE = [
  '/',
  '/index.html',
  '/en/',
  '/en/index.html',
  '/metodologia.html',
  '/en/methodology.html',
  '/historico.html',
  '/en/history.html',
  '/arquivo.html',
  '/aurora-esta-noite.html',
  '/sintomas.html',
  '/en/symptoms.html',
  '/blog/',
  '/blog/index.html',
  '/en/blog/',
  '/en/blog/index.html',
  '/faq.html',
  '/en/faq.html',
  '/termos.html',
  '/privacy.html',
  '/manifest.webmanifest',
  '/sw.js',
  '/js/app.js',
  '/css/style.css',
  '/assets/favicon.svg',
  '/assets/icone-192.png',
  '/assets/icone-512.png',
  '/assets/icone-apple.png',
  '/assets/og.png',
  '/assets/icons/icon-72x72.png',
  '/assets/icons/icon-96x96.png',
  '/assets/icons/icon-128x128.png',
  '/assets/icons/icon-144x144.png',
  '/assets/icons/icon-152x152.png',
  '/assets/icons/icon-192x192.png',
  '/assets/icons/icon-384x384.png',
  '/assets/icons/icon-512x512.png',
  '/assets/fonts/orbitron-var.woff2'
];

self.addEventListener('install', (evt) => {
  // Precache static resources
  evt.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (evt) => {
  // Clean up old caches
  evt.waitUntil(
    caches.keys()
      .then((keyList) => {
        return Promise.all(
          keyList
            .filter((key) => key !== CACHE_NAME && key !== DATA_CACHE_NAME)
            .map((key) => caches.delete(key))
        );
      })
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (evt) => {
  // Cache-first for static assets
  if (evt.request.mode === 'navigate') {
    // For navigation requests, try network first, fall back to cache
    evt.respondWith(
      fetch(evt.request)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }
  
  // For static assets from our origin, cache-first
  if (evt.request.url.startsWith(self.location.origin)) {
    const url = new URL(evt.request.url);
    
    // Don't cache API calls or live data
    if (
      url.pathname.startsWith('/dados/') ||
      url.pathname.includes('api') ||
      url.pathname.includes('swpc.noaa.gov') ||
      url.pathname.includes('usgs.gov') ||
      url.pathname.includes('vlf.it') ||
      url.pathname.includes('ipma.pt') ||
      url.pathname.includes('sos70.ru') ||
      url.pathname.includes('services.swpc.noaa.gov') ||
      url.pathname.includes('earthquake.usgs.gov') ||
      evt.request.url.includes('schumann.json') ||
      evt.request.url.includes('historico.json')
    ) {
      // Network-first for live data
      evt.respondWith(
        fetch(evt.request)
          .catch(() => {
            // If offline, try to return cached error page or fallback
            return caches.match('/offline.html');
          })
      );
      return;
    }
    
    // Cache-first for static assets
    evt.respondWith(
      caches.match(evt.request)
        .then((cachedResponse) => {
          return cachedResponse || fetch(evt.request)
            .then((networkResponse) => {
              // Cache the network response for next time
              return caches.open(CACHE_NAME)
                .then((cache) => {
                  cache.put(evt.request, networkResponse.clone());
                  return networkResponse;
                });
            });
        })
    );
    return;
  }
  
  // For third-party requests, network-first
  evt.respondWith(fetch(evt.request));
});
