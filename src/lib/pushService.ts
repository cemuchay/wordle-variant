import { supabase } from "./supabaseClient";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

// Utility to convert VAPID key
function urlBase64ToUint8Array(base64String: string) {
   const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
   const base64 = (base64String + padding)
      .replace(/-/g, "+")
      .replace(/_/g, "/");
   const rawData = window.atob(base64);
   return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}

export async function subscribeToPush() {
   const registration = await navigator.serviceWorker.ready;

   const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,

      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
   });

   // Save to Supabase

   const { error } = await supabase.from("push_subscriptions").upsert(
      {
         subscription: subscription.toJSON(),
         user_id: (await supabase.auth.getUser()).data.user?.id,
      },
      { onConflict: "subscription" }
   );

   if (error) throw error;
   return subscription;
}
