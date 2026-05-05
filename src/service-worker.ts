// src/service-worker.ts
import { precacheAndRoute } from 'workbox-precaching';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare let self: any;

precacheAndRoute(self.__WB_MANIFEST);

// Handle Push Notifications
// eslint-disable-next-line @typescript-eslint/no-explicit-any
self.addEventListener('push', (event:any) => {
  if (!event.data) return;
  
  const data = event.data.json();
  const options = {
    body: data.body,
    icon: '/pwa_192x192.png',
    badge: '/pwa_192x192.png',
    vibrate: [100, 50, 100],
    data: { url: '/' }
  };

  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
self.addEventListener('push', (event: any) => {
  const data = event.data?.json() ?? { title: 'New Challenge!', body: 'A new word is ready.' };
  
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/pwa_192x192.png',
      badge: '/pwa_192x192.png',
    })
  );
});