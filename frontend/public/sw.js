const CACHE_NAME = 'mubtadiaat-cache-v91';
const urlsToCache = [
  '/',
  '/index.html',
  '/login.html',
  '/logo-v3-sm.png',
  '/logo-v3.webp',
  '/assets/lucide-1.55.0.min.js',
  '/favicon.svg',
  '/manifest.json'
];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .catch(err => console.warn('SW cache addAll gagal:', err))
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  // Lewatkan non-GET (POST/PUT/DELETE) — penting untuk upload & API write.
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);

  // API & dynamic data → network first, fallback cache.
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // Aset ber-hash (JS/CSS hasil build) → cache first (immutable, sudah ada hash-nya).
  if (url.pathname.match(/\.(js|css)$/)) {
    event.respondWith(
      caches.match(event.request).then(cached => cached || fetch(event.request))
    );
    return;
  }

  // Halaman & gambar → network first, fallback cache.
  event.respondWith(
    fetch(event.request)
      .then(response => response)
      .catch(() => caches.match(event.request))
  );
});
