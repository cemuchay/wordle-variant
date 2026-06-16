const CACHE_NAME = "variant-cache-v1";
const STATIC_ASSETS = [
   "/",
   "/index.html",
   "/manifest.json",
   "/pwa_192x192.png",
   "/favicon-32x32.png",
   "/icons.svg"
];

self.addEventListener("install", (event) => {
   event.waitUntil(
      caches.open(CACHE_NAME).then((cache) => {
         return cache.addAll(STATIC_ASSETS);
      })
   );
   self.skipWaiting();
});

self.addEventListener("activate", (event) => {
   event.waitUntil(
      caches.keys().then((keys) => {
         return Promise.all(
            keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
         );
      })
   );
   self.clients.claim();
});

// Lightweight Stale-While-Revalidate caching strategy
self.addEventListener("fetch", (event) => {
   const { request } = event;
   const url = new URL(request.url);

   // Skip non-GET requests and Supabase/External API calls
   if (request.method !== "GET" || url.origin !== self.location.origin || url.pathname.includes("/functions/v1/")) {
      return;
   }

   // For HTML: Network First (ensures we get the latest JS bundle hashes)
   if (request.mode === "navigate") {
      event.respondWith(
         fetch(request)
            .then((response) => {
               const copy = response.clone();
               caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
               return response;
            })
            .catch(() => caches.match(request))
      );
      return;
   }

   // For Assets: Stale-While-Revalidate
   event.respondWith(
      caches.match(request).then((cachedResponse) => {
         const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse.ok) {
               const copy = networkResponse.clone();
               caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
            }
            return networkResponse;
         });

         return cachedResponse || fetchPromise;
      })
   );
});

self.addEventListener("push", (event) => {
   let data = {};

   try {
      data = event.data?.json() ?? {};
   } catch (e) {
      data = { body: event.data?.text() };
   }

   const title = data.title || "New Update";
   const options = {
      body: data.body || "You have a new message.",
      icon: "/pwa_192x192.png",
      badge: "/favicon-32x32.png",
      data: { url: data.url || "/" },
   };

   event.waitUntil(
      self.clients
         .matchAll({ type: "window", includeUncontrolled: true })
         .then((windowClients) => {
            // On iOS, client.focused can be unreliable in PWA standalone mode.
            // We check both focused and visibilityState for better robustness.
            const isAppActive = windowClients.some(
               (client) => client.focused || client.visibilityState === "visible"
            );
            
            // Only show push notification if the app is NOT active
            if (!isAppActive) {
               return self.registration.showNotification(title, options);
            }
         })
   );
});

self.addEventListener("notificationclick", (event) => {
   event.notification.close();

   const urlToOpen = new URL(event.notification.data.url, self.location.origin).href;

   event.waitUntil(
      self.clients
         .matchAll({ type: "window", includeUncontrolled: true })
         .then((windowClients) => {
            // Find a window with matching origin and path
            let matchingClient = null;
            const targetUrlObj = new URL(urlToOpen, self.location.origin);
            for (const client of windowClients) {
               const clientUrlObj = new URL(client.url, self.location.origin);
               if (clientUrlObj.origin === targetUrlObj.origin && clientUrlObj.pathname === targetUrlObj.pathname) {
                  matchingClient = client;
                  break;
               }
            }

            if (matchingClient && "focus" in matchingClient) {
               matchingClient.focus();
               if (matchingClient.navigate) {
                  return matchingClient.navigate(urlToOpen);
               }
               return;
            }

            // If not open, open a new window
            if (self.clients.openWindow) {
               return self.clients.openWindow(urlToOpen);
            }
         })
   );
});
