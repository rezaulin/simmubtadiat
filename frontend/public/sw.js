const CACHE_NAME = 'mubtadiaat-cache-v42';
const urlsToCache = [
  '/index.html',
  '/logo.jpg',
  '/favicon.svg',
  '/style.css'
];

self.addEventListener('install', event => {
  self.skipWaiting(); // Force the waiting service worker to become the active service worker.
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Claim clients so the new SW takes control immediately.
  );
});

self.addEventListener('fetch', event => {
  // Hanya tangani GET. POST/PUT/DELETE (mis. upload import multipart) DILEWATKAN
  // ke jaringan native — SW yang me-refetch request POST bisa gagal & memicu
  // "Failed to fetch" di browser (Cache API juga tak mendukung POST). owner 2026-08.
  if (event.request.method !== 'GET') {
    return; // jangan respondWith → browser handle sendiri
  }
  if (event.request.url.includes('/api/')) {
    // Network first for API
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  } else {
    // Network first, fallback to cache for other things
    event.respondWith(
      fetch(event.request).then(response => {
        // Optionally update the cache with the fresh response
        return response;
      }).catch(() => {
        return caches.match(event.request);
      })
    );
  }
});
