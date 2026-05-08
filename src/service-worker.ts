/* eslint-disable @typescript-eslint/no-explicit-any */
// Define the service worker scope for proper type hinting

/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope;

sw.addEventListener('push', (event: PushEvent) => {
  // eslint-disable-next-line no-useless-assignment
  let data: any = {};

  try {
    data = event.data?.json() ?? {};
  } catch (e) {
    // Fallback for non-JSON or empty payloads
    console.log(e)
    data = { body: event.data?.text() };
  }

  const title = data.title || 'New Update';
  const options: NotificationOptions = {
    body: data.body || 'You have a new message.',
    icon: '/icon-192x192.png',
    badge: '/badge-72x72.png',
    data: { url: data.url || '/' },
  };

  event.waitUntil(sw.registration.showNotification(title, options));
});

sw.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();

  const urlToOpen = new URL(event.notification.data.url, sw.location.origin).href;

  event.waitUntil(
    sw.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // Check if the tab is already open and focus it
      for (const client of windowClients) {
        if (client.url === urlToOpen && 'focus' in client) {
          return client.focus();
        }
      }
      // If not open, open a new window
      if (sw.clients.openWindow) {
        return sw.clients.openWindow(urlToOpen);
      }
    })
  );
});