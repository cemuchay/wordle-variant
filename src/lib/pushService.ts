/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "./supabaseClient";
import { useAppStore } from "../store/useAppStore";

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
   const toast = useAppStore.getState().triggerToast;

   try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
         toast("Notification permission was denied.", 4000);
         throw new Error("Notification permission not granted");
      }

      const registration = await navigator.serviceWorker.ready;

      // Unsubscribe from any active subscriptions first to clear out old keys/stale endpoints
      try {
         const existingSub = await registration.pushManager.getSubscription();
         if (existingSub) {
            await existingSub.unsubscribe();
            console.log(
               "[Push Service] Unsubscribed from legacy subscription successfully.",
            );
         }
      } catch (err) {
         console.warn(
            "[Push Service] Error clearing legacy subscription:",
            err,
         );
      }

      let attempt = 0;
      const maxAttempts = 3;
      let subscription: PushSubscription | null = null;
      let dbError: any = null;

      while (attempt < maxAttempts) {
         attempt++;
         try {
            console.log(
               `[Push Service] Subscribing attempt ${attempt}/${maxAttempts}...`,
            );
            subscription = await registration.pushManager.subscribe({
               userVisibleOnly: true,
               applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });

            // Save to Supabase
            const { error } = await supabase.from("push_subscriptions").upsert(
               {
                  subscription: subscription.toJSON(),
                  user_id: (await supabase.auth.getUser()).data.user?.id,
               },
               { onConflict: "subscription" },
            );

            if (error) {
               dbError = error;
               throw error;
            }

            // If we succeed, exit the retry loop
            dbError = null;
            break;
         } catch (err: any) {
            console.warn(
               `[Push Service] Attempt ${attempt} failed:`,
               err.message || err,
            );
            dbError = err;
            if (attempt < maxAttempts) {
               await new Promise((resolve) => setTimeout(resolve, 1500)); // Wait 1.5s before retry
            }
         }
      }

      if (dbError || !subscription) {
         const errorMsg =
            dbError?.message || "Failed to register push subscription";
         toast(`Push Notification Error: ${errorMsg}`, 5000);
         throw dbError || new Error("Push subscription registration failed");
      }

      toast("Notifications successfully enabled!", 3000);
      return subscription;
   } catch (err: any) {
      console.error("[Push Service] Fatal error in subscribeToPush:", err);
      throw err;
   }
}

export async function unsubscribeFromPush() {
   const toast = useAppStore.getState().triggerToast;
   try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
         // Delete from Supabase first
         const user = (await supabase.auth.getUser()).data.user;
         if (user) {
            await supabase
               .from("push_subscriptions")
               .delete()
               .eq("user_id", user.id);
         }
         
         // Unsubscribe in browser
         await subscription.unsubscribe();
         toast("Notifications disabled.", 3000);
      }
   } catch (err: any) {
      console.error("[Push Service] Unsubscribe failed:", err);
      toast("Failed to disable notifications.", 3000);
   }
}

export async function syncPushSubscriptionIfNeeded() {
   try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Check if notification permission is granted
      if ('Notification' in window && Notification.permission === 'granted') {
         const registration = await navigator.serviceWorker.ready;
         const subscription = await registration.pushManager.getSubscription();

         if (subscription) {
            // Check if this subscription exists in the database
            const { data, error } = await supabase
               .from("push_subscriptions")
               .select("id")
               .eq("user_id", user.id)
               .maybeSingle();

            if (!error && !data) {
               // Subscription exists in browser but not in DB, so upsert it
               console.log("[Push Service] Syncing subscription in background...");
               await supabase.from("push_subscriptions").upsert({
                  subscription: subscription.toJSON(),
                  user_id: user.id,
               });
            }
         } else {
            // Permission is granted but browser doesn't have a subscription yet!
            // We can automatically generate one in the background
            console.log("[Push Service] Generating missing subscription in background...");
            const newSub = await registration.pushManager.subscribe({
               userVisibleOnly: true,
               applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });
            await supabase.from("push_subscriptions").upsert({
               subscription: newSub.toJSON(),
               user_id: user.id,
            });
         }
      }
   } catch (e) {
      console.warn("[Push Service] Background auto-subscribe sync failed:", e);
   }
}
