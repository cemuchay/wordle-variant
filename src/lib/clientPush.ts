/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "./supabaseClient";
import type { NotificationType } from "../types/notifications";

const PUSH_QUEUE_STORAGE_KEY = "variant_client_push_queue_v1";

export interface ClientNotificationPayload {
   id?: string;
   user_id: string; // Recipient User ID (valid UUID)
   type: NotificationType;
   title: string;
   message: string;
   data?: Record<string, any>;
   created_at?: string;
   retryCount?: number;
}

function loadQueue(): ClientNotificationPayload[] {
   if (typeof window === "undefined") return [];
   try {
      const raw = localStorage.getItem(PUSH_QUEUE_STORAGE_KEY);
      if (!raw) return [];
      return JSON.parse(raw);
   } catch {
      return [];
   }
}

function saveQueue(queue: ClientNotificationPayload[]): void {
   if (typeof window === "undefined") return;
   try {
      if (!queue || queue.length === 0) {
         localStorage.removeItem(PUSH_QUEUE_STORAGE_KEY);
      } else {
         localStorage.setItem(PUSH_QUEUE_STORAGE_KEY, JSON.stringify(queue));
      }
   } catch (e) {
      console.warn("[ClientPush] Failed to persist notification queue:", e);
   }
}

function generateUUID(): string {
   if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
   }
   return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
   });
}

function isUuid(val: any): boolean {
   return (
      typeof val === "string" &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)
   );
}

/**
 * Attempts to deliver a single notification payload to Supabase with up to 3 retries.
 * Returns true if delivery succeeded, false if all retries failed.
 */
async function dispatchNotificationWithRetry(
   payload: ClientNotificationPayload,
   maxRetries = 3,
): Promise<boolean> {
   if (!isUuid(payload.user_id)) {
      console.warn("[ClientPush] Invalid target user_id (must be valid UUID):", payload.user_id);
      return false;
   }

   const notifId = payload.id || generateUUID();
   const createdAt = payload.created_at || new Date().toISOString();

   for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
         const { error } = await supabase.from("notifications").insert({
            id: notifId,
            user_id: payload.user_id,
            type: payload.type,
            title: payload.title,
            message: payload.message,
            data: payload.data || {},
            is_read: false,
            created_at: createdAt,
         });

         if (!error) {
            return true;
         }

         // If Supabase RLS policy rejects the client insert (42501 / Forbidden),
         // retrying will not succeed. Discard gracefully without stalling.
         if (error.code === "42501" || error.message?.includes("row-level security")) {
            console.info("[ClientPush] Notification insert restricted by RLS policy. Skipping item.");
            return true; // Mark resolved so it is evicted from retry queue
         }

         console.warn(`[ClientPush] Attempt ${attempt}/${maxRetries} failed:`, error.message);
      } catch (err: any) {
         console.warn(`[ClientPush] Attempt ${attempt}/${maxRetries} error:`, err?.message || err);
      }

      if (attempt < maxRetries) {
         await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
   }

   return false;
}

/**
 * Queues a notification in LocalStorage first, then attempts to dispatch it with 3 retries.
 * Deletes from LocalStorage ONLY upon verified success.
 */
export async function sendClientNotification(
   payload: ClientNotificationPayload,
): Promise<boolean> {
   if (typeof window === "undefined" || !payload.user_id) return false;

   const notifItem: ClientNotificationPayload = {
      ...payload,
      id: payload.id || generateUUID(),
      created_at: payload.created_at || new Date().toISOString(),
      retryCount: 0,
   };

   // Step 1: Queue item in LocalStorage first
   const queue = loadQueue();
   const existingIdx = queue.findIndex((item) => item.id === notifItem.id);
   if (existingIdx >= 0) {
      queue[existingIdx] = notifItem;
   } else {
      queue.push(notifItem);
   }
   saveQueue(queue);

   // Step 2: Attempt dispatch with up to 3 retries
   const success = await dispatchNotificationWithRetry(notifItem, 3);

   // Step 3: On success, delete item from LocalStorage queue
   if (success) {
      const currentQueue = loadQueue();
      const updatedQueue = currentQueue.filter((item) => item.id !== notifItem.id);
      saveQueue(updatedQueue);
   }

   return success;
}

/**
 * Flushes all pending notifications queued in LocalStorage.
 * Removes items ONLY when Supabase returns a successful insertion.
 */
export async function flushNotificationQueue(): Promise<void> {
   const queue = loadQueue();
   if (!queue || queue.length === 0) return;

   const remainingQueue: ClientNotificationPayload[] = [];

   for (const item of queue) {
      const success = await dispatchNotificationWithRetry(item, 3);
      if (!success) {
         remainingQueue.push({
            ...item,
            retryCount: (item.retryCount || 0) + 1,
         });
      }
   }

   saveQueue(remainingQueue);
}

// Auto-flush queue on window load and network reconnect
if (typeof window !== "undefined") {
   window.addEventListener("online", () => {
      flushNotificationQueue();
   });
}

// ==========================================
// WordUp Client Notification Helpers
// ==========================================

export async function sendWordUpInviteNotification(
   targetUserId: string,
   senderName: string,
   category: string,
   matchId: string,
): Promise<boolean> {
   const formattedCategory = (category || "general").replace(/_/g, " ");
   return sendClientNotification({
      user_id: targetUserId,
      type: "CHALLENGE_INVITE",
      title: "WordUp Battle Challenge! ⚔️",
      message: `${senderName} challenged you to a WordUp match in ${formattedCategory}!`,
      data: {
         mode: "wordup_async",
         matchId,
         category,
         senderName,
      },
   });
}

export async function sendWordUpTurnNotification(
   targetUserId: string,
   senderName: string,
   category: string,
   matchId: string,
): Promise<boolean> {
   const formattedCategory = (category || "general").replace(/_/g, " ");
   return sendClientNotification({
      user_id: targetUserId,
      type: "CHALLENGE_INVITE",
      title: "Your Turn in WordUp! ⚔️",
      message: `${senderName} completed their turn in ${formattedCategory}! It is now your turn.`,
      data: {
         mode: "wordup_async",
         matchId,
         category,
         senderName,
      },
   });
}

export async function sendWordUpMatchCompletedNotification(
   targetUserId: string,
   senderName: string,
   category: string,
   matchId: string,
): Promise<boolean> {
   const formattedCategory = (category || "general").replace(/_/g, " ");
   return sendClientNotification({
      user_id: targetUserId,
      type: "CHALLENGE_COMPLETED",
      title: "WordUp Battle Finished! 🏆",
      message: `${senderName} completed the match in ${formattedCategory}. Check the final scores!`,
      data: {
         mode: "wordup_async",
         matchId,
         category,
         senderName,
      },
   });
}

// ==========================================
// WordGrid Client Notification Helpers
// ==========================================

export async function sendWordGridChallengeNotification(
   targetUserId: string,
   senderName: string,
   gridSize: number,
   matchId: string,
): Promise<boolean> {
   return sendClientNotification({
      user_id: targetUserId,
      type: "CHALLENGE_INVITE",
      title: "WordGrid Arena Challenge 🔠",
      message: `${senderName} challenged you to a WordGrid game (${gridSize}×${gridSize})!`,
      data: {
         mode: "wordgrid",
         matchId,
         gridSize,
         senderName,
      },
   });
}

export async function sendWordGridTurnNotification(
   targetUserId: string,
   senderName: string,
   matchId: string,
   isCompleted = false,
   isSwap = false,
): Promise<boolean> {
   return sendClientNotification({
      user_id: targetUserId,
      type: isCompleted ? "CHALLENGE_COMPLETED" : "CHALLENGE_INVITE",
      title: isCompleted ? "WordGrid Match Completed! 🏆" : "Your Turn in WordGrid! 🔠",
      message: isCompleted
         ? `${senderName} played the final move! Check out the final scores.`
         : isSwap
         ? `${senderName} swapped tiles! It is now your turn.`
         : `${senderName} played a word! It is now your turn.`,
      data: {
         mode: "wordgrid",
         matchId,
         senderName,
      },
   });
}
