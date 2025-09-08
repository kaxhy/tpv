/* TPV Rápido – Service Worker
   Estrategias:
   - Navegaciones (HTML): network-first, fallback a cache (modo offline).
   - Assets estáticos (png/jpg/webp/svg/js/css/woff2): cache-first con revalidación en bg.
*/

const VERSION = 'v1.0.0';
const CACHE_STATIC = `tpv-static-${VERSION}`;
const OFFLINE_FALLBACK = './index.html';

// Lista mínima. Añade aquí todo lo que compone tu “app shell”.
const PRECACHE_URLS = [
  './index.html',
  './manifest.json',
  './service-worker.js',
  './icons/icon-48x48.png',
  './icons/icon-72x72.png',
  './icons/icon-96x96.png',
  './icons/icon-128x128.png',
  './icons/icon-144x144.png',
  './icons/icon-151x151.png',
  './icons/icon-192.png',
  './icons/icon-256x256.png',
  './icons/icon-384x384.png',
  './icons/icon-512.png',
  './screenshots/home.png',
  './screenshots/summary.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_STATIC)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Borra caches antiguos
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => k.startsWith('tpv-static-') && k !== CACHE_STATIC)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Pequeño helper
const sameOrigin = (url) => new URL(url, self.location.href).origin === self.location.origin;

// Tipos de assets a cache-first
const ASSET_EXT = /\.(?:png|jpg|jpeg|webp|gif|svg|ico|css|js|mjs|woff2|ttf|otf)$/i;

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  // 1) Navegaciones (páginas): network-first
  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          // Opcional: cachear la navegación para offline futuro
          const cache = await caches.open(CACHE_STATIC);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          // Offline: devuelve lo último cacheado o el fallback
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_FALLBACK);
        }
      })()
    );
    return;
  }

  // 2) Assets estáticos del mismo origen: cache-first con revalidación en background
  if (sameOrigin(request.url) && ASSET_EXT.test(request.url)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(CACHE_STATIC);
        const cached = await cache.match(request);
        const fetchAndUpdate = fetch(request)
          .then((res) => {
            // Evitar cachear respuestas no OK (p.ej. 404)
            if (res.ok) cache.put(request, res.clone());
            return res;
          })
          .catch(() => null);
        // Sirve cache si existe y actualiza en segundo plano
        return cached || fetchAndUpdate || fetch(request);
      })()
    );
    return;
  }

  // 3) Resto: intenta cache, si no, red
  event.respondWith(
    caches.match(request).then((hit) => hit || fetch(request).catch(() => undefined))
  );
});

// Canal para forzar skipWaiting desde el cliente
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
