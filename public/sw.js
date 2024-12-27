const CACHE_NAME = 'ezjp-cache-v1';
const OFFLINE_URL = '/offline';

// Only include public routes and static assets
const urlsToCache = [
  '/',
  '/offline',
  '/download',
  '/icons/favicon.png',
  '/icons/ezjp-app.png',
  '/icons/NHK_logo_2020.png',
  '/favicon.ico'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return Promise.allSettled(
          urlsToCache.map(url => 
            cache.add(url).catch(error => {
              console.log(`Failed to cache ${url}:`, error);
              return null;
            })
          )
        );
      })
  );
});

self.addEventListener('fetch', (event) => {
  // Skip handling URLs with access_token in them
  if (event.request.url.includes('access_token')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Cache hit - return response
        if (response) {
          return response;
        }

        return fetch(event.request).then(
          (response) => {
            // Check if we received a valid response
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response;
            }

            // Clone the response
            const responseToCache = response.clone();

            caches.open(CACHE_NAME)
              .then((cache) => {
                // Don't cache API requests, authentication endpoints, or protected routes
                const url = new URL(event.request.url);
                const protectedPaths = ['/settings', '/profile', '/archive', '/read', '/explorer'];
                const isProtectedPath = protectedPaths.some(path => url.pathname.startsWith(path));

                if (!event.request.url.includes('/api/') && 
                    !event.request.url.includes('/auth/') &&
                    !event.request.url.includes('/_next/data/') &&
                    !isProtectedPath) {
                  cache.put(event.request, responseToCache);
                }
              });

            return response;
          }
        ).catch(() => {
          // If the network request fails, try to return the offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match(OFFLINE_URL);
          }
        });
      })
  );
});

self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
}); 