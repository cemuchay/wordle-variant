const CACHE_NAME = "variant-cache-v2";
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

   // Skip non-GET requests, range requests (iOS audio/video), service worker script, and Supabase/External API calls
   if (
      request.method !== "GET" ||
      url.origin !== self.location.origin ||
      url.pathname === "/sw.js" ||
      url.pathname.includes("/functions/v1/") ||
      request.headers.has("range")
   ) {
      return;
   }

   // For HTML: Fast Network-First (2.5s timeout fallback to cached App Shell for instant PWA reliability)
   // Never allow respondWith to resolve to undefined/null (causes iOS WebKit "Returned response is null" error)
   if (request.mode === "navigate") {
      event.respondWith(
         new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => reject(new Error("Navigation fetch timeout")), 2500);
            fetch(request)
               .then((response) => {
                  clearTimeout(timeoutId);
                  if (response && response.ok) {
                     const copy = response.clone();
                     caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                  }
                  resolve(response);
               })
               .catch((err) => {
                  clearTimeout(timeoutId);
                  reject(err);
               });
         }).catch(async () => {
            const cached =
               (await caches.match(request)) ||
               (await caches.match("/index.html")) ||
               (await caches.match("/"));
            return (
               cached ||
               new Response(
                  "<!doctype html><html><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Variant</title></head><body style='background:#121213;color:#fff;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;text-align:center;padding:20px'><div><h3>Connection Interrupted</h3><p>Please check your connection and tap to reload.</p><button onclick='location.reload()' style='margin-top:12px;padding:10px 20px;border-radius:8px;border:none;background:#10b981;color:#000;font-weight:700;cursor:pointer'>Reload</button></div></body></html>",
                  {
                     status: 503,
                     statusText: "Service Unavailable",
                     headers: { "Content-Type": "text/html; charset=utf-8" },
                  }
               )
            );
         })
      );
      return;
   }

   // For Immutable Hashed Build Assets (/assets/*) & Static Dictionaries (/words/*): Cache-First (0ms latency)
   if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/words/")) {
      event.respondWith(
         caches.match(request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;
            return fetch(request).then((networkResponse) => {
               if (networkResponse && networkResponse.ok && networkResponse.status === 200) {
                  const copy = networkResponse.clone();
                  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
               }
               return networkResponse;
            });
         })
      );
      return;
   }

   // For Other Static Assets: Stale-While-Revalidate
   event.respondWith(
      caches.match(request).then((cachedResponse) => {
         const fetchPromise = fetch(request)
            .then((networkResponse) => {
               if (networkResponse && networkResponse.ok && networkResponse.status === 200) {
                  const copy = networkResponse.clone();
                  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
               }
               return networkResponse;
            })
            .catch((err) => {
               if (cachedResponse) return cachedResponse;
               throw err;
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
      tag: data.tag || undefined,
      renotify: !!data.tag,
      data: { url: data.url || "/" },
   };

   event.waitUntil(
      self.registration.showNotification(title, options)
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
