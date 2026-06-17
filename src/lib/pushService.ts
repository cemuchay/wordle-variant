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

const MAX_SUBSCRIPTIONS_PER_USER = 3;
let isSubscribing = false;

/**
 * Ensures the user doesn't exceed the maximum number of push subscriptions.
 * If the limit is reached, it deletes the oldest subscription(s).
 */
async function enforceSubscriptionLimit(userId: string, newEndpoint: string) {
   try {
      // 1. Get all subscriptions for this user, ordered by age
      const { data: subs, error } = await supabase
         .from("push_subscriptions")
         .select("id, endpoint")
         .eq("user_id", userId)
         .order("created_at", { ascending: true });

      if (error) throw error;
      if (!subs || subs.length < MAX_SUBSCRIPTIONS_PER_USER) return;

      // 2. Check if the new endpoint is already in the list
      const exists = subs.some((s) => s.endpoint === newEndpoint);

      // If the endpoint already exists, we are just updating an existing subscription.
      // We only need to trim if the count is strictly GREATER than the limit.
      const limit = exists
         ? MAX_SUBSCRIPTIONS_PER_USER
         : MAX_SUBSCRIPTIONS_PER_USER - 1;

      if (subs.length <= limit) return;

      // 3. Delete the oldest ones until we are under the limit
      const toDeleteCount = subs.length - limit;
      const staleIds = subs.slice(0, toDeleteCount).map((s) => s.id);

      await supabase.from("push_subscriptions").delete().in("id", staleIds);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
   } catch (err) {
      // not empty
   }
}

export async function subscribeToPush() {
   if (isSubscribing) {
      return;
   }

   const toast = useAppStore.getState().triggerToast;
   isSubscribing = true;

   try {
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
         toast("Notification permission was denied.", 4000);
         throw new Error("Notification permission not granted");
      }

      const registration = await navigator.serviceWorker.ready;

      // Unsubscribe from any active subscriptions first to clear out old keys/stale endpoints in browser
      try {
         const existingSub = await registration.pushManager.getSubscription();
         if (existingSub) {
            await existingSub.unsubscribe();
         }
         // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (err) {
         // not empty
      }

      let attempt = 0;
      const maxAttempts = 3;
      let subscription: PushSubscription | null = null;
      let dbError: any = null;

      while (attempt < maxAttempts) {
         attempt++;
         try {
            subscription = await registration.pushManager.subscribe({
               userVisibleOnly: true,
               applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });

            const {
               data: { user },
            } = await supabase.auth.getUser();
            if (!user) throw new Error("User not authenticated");

            // Enforce limit before saving to Supabase
            await enforceSubscriptionLimit(user.id, subscription.endpoint);

            // Save to Supabase - UPSERT will handle updates if endpoint already exists
            const subData = subscription.toJSON();
            const { error } = await supabase.from("push_subscriptions").upsert(
               {
                  subscription: subData,
                  user_id: user.id,
                  endpoint: subData.endpoint,
                  last_seen_at: new Date().toISOString(),
               },
               { onConflict: "endpoint" },
            );

            if (error) {
               dbError = error;
               throw error;
            }

            // If we succeed, exit the retry loop
            dbError = null;
            break;
         } catch (err: any) {
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
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
   } catch (err: any) {
      // not empty
   } finally {
      isSubscribing = false;
   }
}

export async function unsubscribeFromPush() {
   const toast = useAppStore.getState().triggerToast;
   try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
         const endpoint = subscription.endpoint;

         // Delete only THIS specific subscription from Supabase
         const user = (await supabase.auth.getUser()).data.user;
         if (user) {
            await supabase
               .from("push_subscriptions")
               .delete()
               .eq("user_id", user.id)
               .eq("endpoint", endpoint);
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
      const {
         data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      // Check if notification permission is granted
      if ("Notification" in window && Notification.permission === "granted") {
         const registration = await navigator.serviceWorker.ready;
         const subscription = await registration.pushManager.getSubscription();

         if (subscription) {
            const endpoint = subscription.endpoint;

            // Check if THIS specific subscription exists and its last activity
            const { data, error } = await supabase
               .from("push_subscriptions")
               .select("id, last_seen_at")
               .eq("user_id", user.id)
               .eq("endpoint", endpoint)
               .maybeSingle();

            if (!error && !data) {
               // Subscription exists in browser but not in DB, so upsert it

               await enforceSubscriptionLimit(user.id, endpoint);

               const subData = subscription.toJSON();
               await supabase.from("push_subscriptions").upsert(
                  {
                     subscription: subData,
                     user_id: user.id,
                     endpoint: endpoint,
                     last_seen_at: new Date().toISOString(),
                  },
                  { onConflict: "endpoint" },
               );
            } else if (!error && data) {
               // Throttle: Only update last_seen_at if it's been more than 24 hours
               const lastSeen = new Date(data.last_seen_at).getTime();
               const now = new Date().getTime();
               const hoursSinceLastSeen = (now - lastSeen) / (1000 * 60 * 60);

               if (hoursSinceLastSeen > 24) {
                  await supabase
                     .from("push_subscriptions")
                     .update({ last_seen_at: new Date().toISOString() })
                     .eq("endpoint", endpoint);
               }
            }
         } else {
            // Permission is granted but browser doesn't have a subscription yet!
            // We can automatically generate one in the background
            const newSub = await registration.pushManager.subscribe({
               userVisibleOnly: true,
               applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
            });

            await enforceSubscriptionLimit(user.id, newSub.endpoint);

            const subData = newSub.toJSON();
            await supabase.from("push_subscriptions").upsert(
               {
                  subscription: subData,
                  user_id: user.id,
                  endpoint: subData.endpoint,
                  last_seen_at: new Date().toISOString(),
               },
               { onConflict: "endpoint" },
            );
         }
      }
   } catch (e) {
      console.warn("[Push Service] Background auto-subscribe sync failed:", e);
   }
}
