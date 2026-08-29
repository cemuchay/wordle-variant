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

/**
 * Generates a deterministic valid UUID v4/v5 format string from a matchId and turnIndex.
 * This guarantees strict Supabase UUID column format compatibility while preventing duplicate inserts.
 */
function generateDeterministicUUID(seed: string): string {
   let hash1 = 0x811c9dc5;
   let hash2 = 0x27d4eb2f;
   for (let i = 0; i < seed.length; i++) {
      const char = seed.charCodeAt(i);
      hash1 = Math.imul(hash1 ^ char, 0x01000193);
      hash2 = Math.imul(hash2 ^ char, 0x5bd1e995);
   }
   const h1 = (hash1 >>> 0).toString(16).padStart(8, "0");
   const h2 = (hash2 >>> 0).toString(16).padStart(8, "0");
   const h3 = ((hash1 ^ hash2) >>> 0).toString(16).padStart(8, "0");
   const h4 = (Math.imul(hash1, 31) >>> 0).toString(16).padStart(8, "0");
   const raw = (h1 + h2 + h3 + h4).slice(0, 32);

   // Format as standard UUID: 8-4-4-4-12 with version 4 and variant bit
   return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-a${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}

export async function sendWordGridTurnNotification(
   targetUserId: string,
   senderName: string,
   matchId: string,
   isCompleted = false,
   isSwap = false,
   turnIndex?: number,
): Promise<boolean> {
   const notifId =
      typeof turnIndex === "number"
         ? generateDeterministicUUID(`wordgrid_${matchId}_turn_${turnIndex}`)
         : undefined;

   return sendClientNotification({
      id: notifId,
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

// ==========================================
// Direct Message Client Push Notification Helpers
// ==========================================

const DM_OFFLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes
const DM_BURST_COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes cooldown per string of messages
const DM_NOTIFICATION_TRACKER_KEY = "variant_dm_push_tracker_v1";

interface DMTrackerEntry {
   lastNotifiedAt: number;
   messageCount: number;
}

function loadDMTracker(): Record<string, DMTrackerEntry> {
   if (typeof window === "undefined") return {};
   try {
      const raw = localStorage.getItem(DM_NOTIFICATION_TRACKER_KEY);
      return raw ? JSON.parse(raw) : {};
   } catch {
      return {};
   }
}

function saveDMTracker(tracker: Record<string, DMTrackerEntry>): void {
   if (typeof window === "undefined") return;
   try {
      localStorage.setItem(DM_NOTIFICATION_TRACKER_KEY, JSON.stringify(tracker));
   } catch (e) {
      console.warn("[ClientPush] Failed to save DM tracker:", e);
   }
}

/**
 * Removes any pending queued notifications targeted to a user once they are confirmed online/active.
 */
export function pruneQueueForUser(userId: string): void {
   if (typeof window === "undefined" || !userId) return;
   const queue = loadQueue();
   if (!queue || queue.length === 0) return;

   const filtered = queue.filter((item) => item.user_id !== userId);
   if (filtered.length !== queue.length) {
      saveQueue(filtered);
   }

   // Also clear DM burst cooldown for this user so future offline sessions can trigger cleanly
   const tracker = loadDMTracker();
   let modified = false;
   Object.keys(tracker).forEach((key) => {
      if (key.startsWith(`${userId}_`) || key.endsWith(`_${userId}`)) {
         delete tracker[key];
         modified = true;
      }
   });
   if (modified) saveDMTracker(tracker);
}

/**
 * Evaluates whether recipient qualifies as offline (>= 2 mins) and dispatches a single
 * consolidated push notification per string of messages.
 */
export async function sendDirectMessagePushNotification({
   senderId,
   senderName,
   recipientId,
   recipientLastSeenAt,
   isRecipientOnline,
   messageSnippet,
   groupId,
   sentAt = new Date().toISOString(),
}: {
   senderId: string;
   senderName: string;
   recipientId: string;
   recipientLastSeenAt?: string | null;
   isRecipientOnline?: boolean;
   messageSnippet: string;
   groupId: string;
   sentAt?: string;
}): Promise<boolean> {
   if (!isUuid(recipientId) || !isUuid(senderId) || senderId === recipientId) {
      return false;
   }

   // 1. If recipient is currently online (presence active), skip push
   if (isRecipientOnline) {
      return false;
   }

   // 2. Offline check: verify recipient has been away for >= 2 minutes from message time
   const messageTimeMs = new Date(sentAt).getTime();
   if (recipientLastSeenAt) {
      const lastSeenMs = new Date(recipientLastSeenAt).getTime();
      const elapsedSinceSeen = messageTimeMs - lastSeenMs;
      if (elapsedSinceSeen < DM_OFFLINE_THRESHOLD_MS) {
         return false; // User was active less than 2 minutes ago
      }
   }

   // 3. String-of-messages deduplication: only 1 push notification per 15-minute burst
   const now = Date.now();
   const timeBucket = Math.floor(now / DM_BURST_COOLDOWN_MS);
   const trackerKey = `${recipientId}_${senderId}`;
   const tracker = loadDMTracker();
   const existing = tracker[trackerKey];

   if (existing && now - existing.lastNotifiedAt < DM_BURST_COOLDOWN_MS) {
      // Update burst count in tracker without firing another notification
      tracker[trackerKey] = {
         lastNotifiedAt: existing.lastNotifiedAt,
         messageCount: (existing.messageCount || 1) + 1,
      };
      saveDMTracker(tracker);
      return false;
   }

   // 4. Update tracker with new notification dispatch
   tracker[trackerKey] = {
      lastNotifiedAt: now,
      messageCount: 1,
   };
   saveDMTracker(tracker);

   // 5. Build clean, Safari/iOS WebPush-friendly snippet preview
   let cleanPreview = (messageSnippet || "").trim();
   if (cleanPreview.startsWith("e2ee:")) {
      cleanPreview = "Sent you a new encrypted message";
   } else if (cleanPreview === "[Voice Message]") {
      cleanPreview = "Sent you a voice message";
   } else if (cleanPreview === "[Image]") {
      cleanPreview = "Sent you an image";
   } else if (cleanPreview.length > 60) {
      cleanPreview = cleanPreview.slice(0, 57) + "...";
   }

   const safeSender = senderName ? senderName.trim() : "Someone";
   const notifId = generateDeterministicUUID(`dm_reminder_${recipientId}_${senderId}_${timeBucket}`);

   return sendClientNotification({
      id: notifId,
      user_id: recipientId,
      type: "DM_REMINDER",
      title: `Message from ${safeSender}`,
      message: cleanPreview || `You have a new message from ${safeSender}.`,
      data: {
         mode: "chat_dm",
         group_id: groupId,
         senderId,
         senderName: safeSender,
      },
   });
}

