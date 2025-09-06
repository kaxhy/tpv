const CACHE = 'tpv-cache-v1';
const ASSETS = [
  './index.html', // renombra si tu archivo no es index
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(()=> self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(()=> self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  e.respondWith(
    caches.match(req).then(cached => cached || fetch(req).then(res => {
      // (opcional) cache dinámico de navegaciones
      if (req.method === 'GET' && (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html'))) {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
      }
      return res;
    }).catch(()=> caches.match('./index.html')))
  );
});
