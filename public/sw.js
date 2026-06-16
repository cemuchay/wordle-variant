self.addEventListener("install", (event) => {
   event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
   event.waitUntil(self.clients.claim());
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
            const isAppFocused = windowClients.some((client) => client.focused);
            // Temporarily allow push notifications even if the app is focused/open
            if (true || !isAppFocused) {
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
            // Check if the tab is already open and focus it
            for (const client of windowClients) {
               if (client.url === urlToOpen && "focus" in client) {
                  return client.focus();
               }
            }
            // If not open, open a new window
            if (self.clients.openWindow) {
               return self.clients.openWindow(urlToOpen);
            }
         })
   );
});
