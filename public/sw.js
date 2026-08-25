// Gappify Celigo Remediation Hub - Service Worker
const CACHE_NAME = 'gappify-celigo-v1';
const ASSETS_TO_CACHE = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/favicon-32x32.png',
  '/favicon-16x16.png',
  '/apple-touch-icon.png',
  '/android-chrome-192x192.png',
  '/site.webmanifest'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE).catch((err) => {
        console.warn('SW cache.addAll partially failed', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Network-first strategy for API and dynamic assets, Cache-first for static icons
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);

  // Bypass API calls from cache
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.status === 200 && response.type === 'basic') {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;
        if (event.request.headers.get('accept')?.includes('text/html')) {
          return caches.match('/index.html');
        }
      })
  );
});

// Web Push Event Handler for 24/7 Mobile/Desktop Native OS Alerts
self.addEventListener('push', (event) => {
  let data = {
    title: '⚠️ Celigo Integration Alert',
    body: 'New integration error detected. Open Gappify Hub to inspect.',
    url: '/?tab=errors'
  };

  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body || 'Unresolved Celigo errors require attention.',
    icon: data.icon || '/favicon-32x32.png',
    badge: '/favicon-16x16.png',
    tag: data.tag || 'celigo-bg-alert',
    renotify: true,
    vibrate: [200, 100, 200],
    data: { url: data.url || '/?tab=errors' },
    actions: [
      { action: 'open', title: 'Open Hub' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(data.title || '⚠️ Celigo Integration Alert', options)
  );
});

// Periodic Background Sync Event Handler (Chrome / Android PWA)
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'celigo-background-sync') {
    event.waitUntil(
      fetch('/api/background-sync/trigger', { method: 'POST' }).catch((err) => {
        console.warn('SW Periodic sync trigger error:', err);
      })
    );
  }
});

// Notification click handling
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'dismiss') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        let client = clientList[0];
        for (let i = 0; i < clientList.length; i++) {
          if (clientList[i].focused) {
            client = clientList[i];
            break;
          }
        }
        return client.focus();
      }
      return clients.openWindow('/?tab=errors');
    })
  );
});
