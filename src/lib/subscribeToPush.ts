const subscribeToPush = async () => {
   const registration = await navigator.serviceWorker.ready;

   // 1. Check/Request Permission
   const permission = await Notification.requestPermission();
   if (permission !== "granted") return;

   // 2. Subscribe to the Push Service
   const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey:
         "BOqGseKbd6xrPQTWmuVudJjL4a28cf5zGnVmK6BdvsY3-wjV5V3FNdYIIYXSGKAZd1Wcechnh9DemdvOX1GJIEU", // Generate this via 'web-push'
   });

   // 3. Send to Supabase
   // Save this to your 'profiles' table so you can trigger notifications
   // when a player is overtaken on the leaderboard_weekly
   console.log("Push Subscription:", subscription);
};

export { subscribeToPush };
