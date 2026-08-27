const CACHE_NAME = 'mubtadiaat-cache-v36';
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
