/* eslint-disable @typescript-eslint/no-explicit-any */
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "../lib/supabaseClient";
import { useAppStore } from "../store/useAppStore";
import { safeLocalStorage } from "../utils/storage";
import {
   getLagosDateSync,
   getTrustedDeviceStamp,
   saveTrustedDeviceStamp,
} from "../utils/trustedDevice";
import {
   getAllMessages,
   purgeMessagesOlderThan,
   saveMessages,
} from "../utils/indexedDBMessages";
import { isReactionRow, mergeReadReceipts } from "../utils/readReceipts";
import { LIMITS, MISC, TIMEOUT } from "../constants/game";
import { scheduleIdleWordListPreload } from "../data/words";

export interface RetryOptions {
   maxRetries?: number;
   baseDelayMs?: number;
   label?: string;
}

const QUICK_FOCUS_THRESHOLD_MS = 30 * 1000; // < 30s: zero network spam on quick tab switch
const FULL_RECONCILE_THRESHOLD_MS = 15 * 60 * 1000; // > 15m: full game & date reconciliation

/**
 * Executes an async operation with exponential backoff + jitter and offline awareness.
 */
export async function runWithFailSafeRetry<T>(
   fn: () => Promise<T>,
   options: RetryOptions = {},
): Promise<T> {
   const maxRetries = options.maxRetries ?? 3;
   const baseDelayMs = options.baseDelayMs ?? 500;
   let lastError: unknown;

   for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
         return await fn();
      } catch (err) {
         lastError = err;
         if (attempt === maxRetries) break;

         // If offline, wait briefly or until online event fires
         if (typeof navigator !== "undefined" && navigator.onLine === false) {
            await new Promise<void>((resolve) => {
               const onOnline = () => {
                  window.removeEventListener("online", onOnline);
                  resolve();
               };
               window.addEventListener("online", onOnline, { once: true });
               setTimeout(() => {
                  window.removeEventListener("online", onOnline);
                  resolve();
               }, 5000);
            });
         } else {
            const backoff = baseDelayMs * Math.pow(2, attempt);
            const jitter = Math.floor(Math.random() * 200);
            await new Promise((res) => setTimeout(res, backoff + jitter));
         }
      }
   }

   throw lastError;
}

function runWhenIdle(cb: () => void, timeoutMs = 2500): () => void {
   if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      const id = (window as any).requestIdleCallback(cb, { timeout: timeoutMs });
      return () => (window as any).cancelIdleCallback?.(id);
   }
   const timer = setTimeout(cb, 300);
   return () => clearTimeout(timer);
}

class BootOrchestrator {
   private lastMessageSyncAt = 0;
   private lastHiddenAt = Date.now();
   private lastKnownLagosDate = getLagosDateSync();
   private isChatBootstrappedForUser: string | null = null;

   /**
    * Stage 0: Synchronously seed TanStack Query cache from hot localStorage keys
    * so components reading query data on Frame 0 have zero wait.
    */
   public seedHotCacheSync(queryClient: QueryClient, userId?: string): void {
      try {
         const todayLagos = getLagosDateSync();
         this.lastKnownLagosDate = todayLagos;

         if (!queryClient.getQueryData(["server-date"])) {
            const stamp = getTrustedDeviceStamp();
            const cachedDateRaw = safeLocalStorage.getItem("cached-server-date");
            if (stamp || cachedDateRaw) {
               queryClient.setQueryData(["server-date"], {
                  raw: new Date(),
                  formatted: todayLagos,
               });
            }
         }

         if (userId && !queryClient.getQueryData(["profile", userId])) {
            const cachedProfile = safeLocalStorage.getItem(`cached-profile-${userId}`);
            if (cachedProfile) {
               queryClient.setQueryData(["profile", userId], JSON.parse(cachedProfile));
            }
         }

         if (userId && !queryClient.getQueryData(["challenge-unread", userId])) {
            const cachedChallengeStatus = safeLocalStorage.getItem(
               `cached-challenge-status-${userId}`,
            );
            if (cachedChallengeStatus) {
               queryClient.setQueryData(
                  ["challenge-unread", userId],
                  JSON.parse(cachedChallengeStatus),
               );
            }
         }

         if (!queryClient.getQueryData(["discover-challenges"])) {
            const cachedDiscover = safeLocalStorage.getItem(
               "wordle_discover_challenges_cache",
            );
            if (cachedDiscover) {
               queryClient.setQueryData(
                  ["discover-challenges"],
                  JSON.parse(cachedDiscover),
               );
            }
         }
      } catch {
         // Non-fatal cache seed error
      }
   }

   /**
    * Stage 1 & 2: Orchestrates initial chat + receipts + background query warm-up
    * with fail-safe retry and without blocking the main thread.
    */
   public async bootstrapUserSession(
      userId: string,
      queryClient: QueryClient,
   ): Promise<void> {
      this.seedHotCacheSync(queryClient, userId);

      // Update Trusted Device stamp once user session is active
      saveTrustedDeviceStamp({
         isAuthenticated: true,
         date: getLagosDateSync(),
      });

      // Stage 2A: Restore IndexedDB cached chat messages asynchronously off the critical frame
      if (this.isChatBootstrappedForUser !== userId) {
         this.isChatBootstrappedForUser = userId;
         runWhenIdle(() => {
            this.hydrateAndSyncChatMessages(userId).catch((err) => {
               console.warn("[BootOrchestrator] Chat bootstrap warning:", err);
            });
         }, 1500);
      }

      // Stage 2B: Prefetch tab data in idle time so tab switching is 0ms
      runWhenIdle(() => {
         scheduleIdleWordListPreload(5);
      }, 2000);
   }

   /**
    * Hydrates cached messages from IndexedDB first (instant local restore),
    * then fetches delta messages, read receipts, and group memberships in parallel with retry.
    */
   public async hydrateAndSyncChatMessages(userId: string): Promise<void> {
      // 1. Restore cached messages from IndexedDB immediately before hitting network
      let cachedMessages: any[] = [];
      try {
         cachedMessages = (await getAllMessages()).filter(
            (m: any) => !isReactionRow(m.content),
         );
         if (cachedMessages.length > 0) {
            cachedMessages.sort(
               (a: any, b: any) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime(),
            );
            useAppStore.getState().setGlobalMessages(cachedMessages);
         }
      } catch (e) {
         console.warn("Failed to read cached messages from IndexedDB:", e);
      }

      // 2. Fetch receipts, memberships, and message delta concurrently with fail-safe retry
      const latestTimestamp =
         cachedMessages.length > 0
            ? cachedMessages[cachedMessages.length - 1].created_at
            : null;

      await runWithFailSafeRetry(
         async () => {
            const [receiptRes, memberRes, messagesRes] = await Promise.all([
               supabase
                  .from("chat_read_receipts")
                  .select("group_id, last_seen_at")
                  .eq("user_id", userId),
               supabase
                  .from("chat_group_members")
                  .select("group_id")
                  .eq("user_id", userId)
                  .eq("status", "joined"),
               latestTimestamp
                  ? supabase
                       .from("messages")
                       .select("*, profiles(username, avatar_url)")
                       .gt("created_at", latestTimestamp)
                       .order("created_at", { ascending: true })
                  : supabase
                       .from("messages")
                       .select("*, profiles(username, avatar_url)")
                       .order("created_at", { ascending: false })
                       .limit(LIMITS.MESSAGES),
            ]);

            if (receiptRes.data) {
               const receipts: Record<string, string> = {};
               receiptRes.data.forEach((r) => {
                  receipts[r.group_id] = r.last_seen_at;
               });
               const currentReceipts = useAppStore.getState().readReceipts;
               useAppStore
                  .getState()
                  .setReadReceipts(mergeReadReceipts(currentReceipts, receipts));
            }

            const joinedSet = new Set<string>([
               "00000000-0000-0000-0000-000000000001",
               "00000000-0000-0000-0000-000000000002",
               "00000000-0000-0000-0000-000000000003",
            ]);
            if (memberRes.data) {
               memberRes.data.forEach((m) => joinedSet.add(m.group_id));
            }
            useAppStore.getState().setJoinedGroupIds(Array.from(joinedSet));

            if (!messagesRes.error && messagesRes.data) {
               if (latestTimestamp) {
                  const fresh = messagesRes.data.filter(
                     (m: any) => !isReactionRow(m.content),
                  );
                  fresh.forEach((msg) => {
                     useAppStore.getState().addGlobalMessage(msg);
                  });
                  if (fresh.length > 0) {
                     saveMessages(fresh).catch(() => {});
                  }
               } else {
                  const chronData = [...messagesRes.data]
                     .reverse()
                     .filter((m: any) => !isReactionRow(m.content));
                  useAppStore.getState().setGlobalMessages(chronData);
                  saveMessages(chronData).catch(() => {});
               }
            }
         },
         { maxRetries: 2, baseDelayMs: 600, label: "chat_bootstrap" },
      );

      this.lastMessageSyncAt = Date.now();
      purgeMessagesOlderThan(MISC.MESSAGE_PURGE_DAYS).catch(() => {});
   }

   /**
    * Lightweight delta message sync when returning from background or reconnecting.
    */
   public async syncMessageDelta(
      userId: string,
      queryClient: QueryClient,
   ): Promise<void> {
      const now = Date.now();
      if (now - this.lastMessageSyncAt < TIMEOUT.MESSAGE_SYNC_THROTTLE) return;
      this.lastMessageSyncAt = now;

      queryClient.invalidateQueries({ queryKey: ["notifications", userId] });

      const currentMessages = useAppStore.getState().globalMessages;
      if (currentMessages.length === 0) {
         await this.hydrateAndSyncChatMessages(userId);
         return;
      }

      const lastMessage = currentMessages[currentMessages.length - 1];
      const lastCreatedAt = lastMessage?.created_at;
      if (!lastCreatedAt) return;

      await runWithFailSafeRetry(
         async () => {
            const { data, error } = await supabase
               .from("messages")
               .select("*, profiles(username, avatar_url)")
               .gt("created_at", lastCreatedAt)
               .order("created_at", { ascending: true });

            if (error) throw error;
            if (data && data.length > 0) {
               const fresh = data.filter((m: any) => !isReactionRow(m.content));
               fresh.forEach((msg) => {
                  useAppStore.getState().addGlobalMessage(msg);
               });
               if (fresh.length > 0) {
                  saveMessages(fresh).catch(() => {});
               }
            }
         },
         { maxRetries: 2, baseDelayMs: 500, label: "chat_delta" },
      );
   }

   /**
    * Duration-tiered handler for tab visibility / window focus changes.
    * - < 30s away: No-op (instant resume, zero network spam)
    * - 30s - 15m away: Silent chat delta sync
    * - > 15m away, was disconnected, or Lagos date rolled over past midnight:
    *   Full background game state & date reconciliation (triggers isRevalidating mutation lock)
    */
   public handleVisibilityChange(params: {
      isVisible: boolean;
      userId?: string;
      queryClient: QueryClient;
      wasDisconnected: boolean;
      clearDisconnectedFlag: () => void;
   }): void {
      const {
         isVisible,
         userId,
         queryClient,
         wasDisconnected,
         clearDisconnectedFlag,
      } = params;

      if (!isVisible) {
         this.lastHiddenAt = Date.now();
         this.lastKnownLagosDate = getLagosDateSync();
         return;
      }

      const timeHiddenMs = Date.now() - this.lastHiddenAt;
      const currentLagosDate = getLagosDateSync();
      const didDateRollOver = currentLagosDate !== this.lastKnownLagosDate;
      this.lastKnownLagosDate = currentLagosDate;

      // Tier 1: Quick tab switch (< 30s) and connection remained healthy -> 0 network requests
      if (
         timeHiddenMs < QUICK_FOCUS_THRESHOLD_MS &&
         !wasDisconnected &&
         !didDateRollOver
      ) {
         return;
      }

      // Tier 2: Medium or Long absence -> sync delta messages silently
      if (userId) {
         this.syncMessageDelta(userId, queryClient).catch(() => {});
      }

      // Tier 3: Long absence (> 15m), disconnected recovery, or cross-midnight rollover
      if (
         wasDisconnected ||
         didDateRollOver ||
         timeHiddenMs >= FULL_RECONCILE_THRESHOLD_MS
      ) {
         queryClient.refetchQueries({ queryKey: ["server-date"], type: "active" });
         window.dispatchEvent(new CustomEvent("app-visibility-visible"));
         clearDisconnectedFlag();
      }
   }
}

export const bootOrchestrator = new BootOrchestrator();
