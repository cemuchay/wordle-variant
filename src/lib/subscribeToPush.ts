const subscribeToPush = async () => {
   const registration = await navigator.serviceWorker.ready;

   // 1. Check/Request Permission
   const permission = await Notification.requestPermission();
   if (permission !== "granted") return;

   // 2. Subscribe to the Push Service
   await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey:
         "BOqGseKbd6xrPQTWmuVudJjL4a28cf5zGnVmK6BdvsY3-wjV5V3FNdYIIYXSGKAZd1Wcechnh9DemdvOX1GJIEU", // Generate this via 'web-push'
   });

   // 3. Send to Supabase

};

export { subscribeToPush };
