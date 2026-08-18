/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "./supabaseClient";

const TELEMETRY_STORAGE_KEY = "variant_telemetry_v1";
const CLIENT_HASH_KEY = "variant_telemetry_client_hash";

export interface GameCompletions {
   main_daily: number;
   wordup: number;
   challenge: number;
   marathon: number;
}

export interface TelemetryBucket {
   date: string; // ISO format YYYY-MM-DD
   appOpens: number;
   timeSpentSeconds: number;
   clicksPerSection: Record<string, number>;
   timeSpentPerSection: Record<string, number>;
   isBounce: boolean;
   totalInteractions: number;
   lastActiveTimestamp: number;
   currentActiveSection: string | null;
   sectionStartTime: number | null;
   // Enhanced Lifecycle & Attribution Properties
   dailyCompleted?: boolean;
   opensBeforeCompletion?: number;
   opensAfterCompletion?: number;
   openedViaNotification?: boolean;
   notificationOpensCount?: number;
   gamesCompleted?: GameCompletions;
   isGhostSuspect?: boolean;
}

function getTodayStr(): string {
   return new Date().toISOString().split("T")[0];
}

export function getOrCreateClientHash(): string {
   if (typeof window === "undefined") return "server_placeholder";
   let hash = localStorage.getItem(CLIENT_HASH_KEY);
   if (!hash) {
      hash = Array.from(crypto.getRandomValues(new Uint8Array(16)))
         .map((b) => b.toString(16).padStart(2, "0"))
         .join("");
      localStorage.setItem(CLIENT_HASH_KEY, hash);
   }
   return hash;
}

function loadLocalBucket(): TelemetryBucket | null {
   if (typeof window === "undefined") return null;
   try {
      const raw = localStorage.getItem(TELEMETRY_STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
   } catch {
      return null;
   }
}

function saveLocalBucket(bucket: TelemetryBucket | null): void {
   if (typeof window === "undefined") return;
   if (!bucket) {
      localStorage.removeItem(TELEMETRY_STORAGE_KEY);
      return;
   }
   try {
      localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(bucket));
   } catch (e) {
      console.warn("Failed to persist telemetry bucket:", e);
   }
}

/**
 * Checks if the current session was opened via a push notification
 */
export function checkIsNotificationLaunch(): boolean {
   if (typeof window === "undefined") return false;
   try {
      const url = new URL(window.location.href);
      const isPushSource = url.searchParams.get("source") === "push_notification" ||
                           url.searchParams.get("utm_medium") === "push" ||
                           url.searchParams.get("notification") === "true";
      return isPushSource;
   } catch {
      return false;
   }
}

/**
 * Attempts to flush a given telemetry bucket to Supabase with up to 3 retries.
 * Returns true if submission succeeded, false otherwise.
 */
async function submitBucketWithRetry(bucket: TelemetryBucket, maxRetries = 3): Promise<boolean> {
   const clientHash = getOrCreateClientHash();
   const isBounce = bucket.timeSpentSeconds < 10 && bucket.totalInteractions <= 1;
   
   // Ghost user suspect: Session duration < 3s, 0 user interactions, 1 open or background ping
   const isGhostSuspect = Boolean(bucket.timeSpentSeconds < 3 && bucket.totalInteractions === 0);

   for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
         const { error } = await supabase.rpc("submit_daily_telemetry", {
            p_date: bucket.date,
            p_client_hash: clientHash,
            p_app_opens: bucket.appOpens,
            p_time_spent_seconds: bucket.timeSpentSeconds,
            p_clicks_per_section: bucket.clicksPerSection || {},
            p_time_spent_per_section: bucket.timeSpentPerSection || {},
            p_is_bounce: isBounce,
            p_daily_completed: bucket.dailyCompleted || false,
            p_opens_before_completion: bucket.opensBeforeCompletion ?? bucket.appOpens,
            p_opens_after_completion: bucket.opensAfterCompletion ?? 0,
            p_opened_via_notification: bucket.openedViaNotification || false,
            p_notification_opens_count: bucket.notificationOpensCount || 0,
            p_games_completed: bucket.gamesCompleted || { main_daily: 0, wordup: 0, challenge: 0, marathon: 0 },
            p_is_ghost_suspect: bucket.isGhostSuspect ?? isGhostSuspect,
         });

         if (!error) {
            return true;
         }
         console.warn(`[Telemetry] Attempt ${attempt}/${maxRetries} failed:`, error.message);
      } catch (err: any) {
         console.warn(`[Telemetry] Attempt ${attempt}/${maxRetries} error:`, err?.message || err);
      }

      if (attempt < maxRetries) {
         await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      }
   }

   return false;
}

let activeTimer: ReturnType<typeof setTimeout> | null = null;
let currentBucket: TelemetryBucket | null = null;

function flushCurrentActiveSectionDuration(): void {
   if (!currentBucket || !currentBucket.currentActiveSection || !currentBucket.sectionStartTime) return;
   const elapsedSeconds = Math.floor((Date.now() - currentBucket.sectionStartTime) / 1000);
   if (elapsedSeconds > 0) {
      const section = currentBucket.currentActiveSection;
      currentBucket.timeSpentPerSection[section] = (currentBucket.timeSpentPerSection[section] || 0) + elapsedSeconds;
   }
   currentBucket.sectionStartTime = Date.now();
}

/**
 * Initializes telemetry tracking on app boot.
 * - Flushes any previous unsubmitted day's telemetry (retries 3 times, clears ONLY on success).
 * - Creates/updates today's telemetry bucket with lifecycle & attribution metrics.
 * - Registers visibility change listeners to accurately track active session time.
 */
export async function initTelemetry(): Promise<void> {
   if (typeof window === "undefined") return;

   const todayStr = getTodayStr();
   const storedBucket = loadLocalBucket();
   const isNotif = checkIsNotificationLaunch();

   // If there is an unsubmitted bucket from a previous date, flush it first
   if (storedBucket && storedBucket.date !== todayStr) {
      const success = await submitBucketWithRetry(storedBucket, 3);
      if (success) {
         saveLocalBucket(null); // Clear local storage ONLY upon verified success
      }
      // If failed, storedBucket remains in localStorage and will retry on next initialization
   }

   // Initialize or resume today's bucket
   const existing = loadLocalBucket();
   if (existing && existing.date === todayStr) {
      currentBucket = existing;
      currentBucket.appOpens += 1;
      currentBucket.lastActiveTimestamp = Date.now();
      currentBucket.sectionStartTime = Date.now();

      // Track lifecycle open counts
      if (currentBucket.dailyCompleted) {
         currentBucket.opensAfterCompletion = (currentBucket.opensAfterCompletion || 0) + 1;
      } else {
         currentBucket.opensBeforeCompletion = (currentBucket.opensBeforeCompletion || 0) + 1;
      }

      if (isNotif) {
         currentBucket.openedViaNotification = true;
         currentBucket.notificationOpensCount = (currentBucket.notificationOpensCount || 0) + 1;
      }
   } else {
      currentBucket = {
         date: todayStr,
         appOpens: 1,
         timeSpentSeconds: 0,
         clicksPerSection: {},
         timeSpentPerSection: {},
         isBounce: true,
         totalInteractions: 0,
         lastActiveTimestamp: Date.now(),
         currentActiveSection: "main-dashboard",
         sectionStartTime: Date.now(),
         dailyCompleted: false,
         opensBeforeCompletion: 1,
         opensAfterCompletion: 0,
         openedViaNotification: isNotif,
         notificationOpensCount: isNotif ? 1 : 0,
         gamesCompleted: { main_daily: 0, wordup: 0, challenge: 0, marathon: 0 },
         isGhostSuspect: false,
      };
   }

   saveLocalBucket(currentBucket);

   // Start heartbeat timer for active session duration
   if (activeTimer) clearInterval(activeTimer);
   activeTimer = setInterval(() => {
      if (currentBucket && document.visibilityState === "visible") {
         currentBucket.timeSpentSeconds += 1;
         currentBucket.lastActiveTimestamp = Date.now();
         currentBucket.isBounce = currentBucket.timeSpentSeconds < 10 && currentBucket.totalInteractions <= 1;
         currentBucket.isGhostSuspect = currentBucket.timeSpentSeconds < 3 && currentBucket.totalInteractions === 0;
         saveLocalBucket(currentBucket);
      }
   }, 1000);

   // Listen for page visibility changes
   document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
         flushCurrentActiveSectionDuration();
         saveLocalBucket(currentBucket);
      } else if (document.visibilityState === "visible" && currentBucket) {
         currentBucket.sectionStartTime = Date.now();
      }
   });

   // Listen for page unload
   window.addEventListener("beforeunload", () => {
      flushCurrentActiveSectionDuration();
      saveLocalBucket(currentBucket);
   });
}

/**
 * Marks daily puzzle game as completed for today's session.
 */
export function trackDailyGameCompleted(): void {
   if (!currentBucket) return;
   currentBucket.dailyCompleted = true;
   if (!currentBucket.gamesCompleted) {
      currentBucket.gamesCompleted = { main_daily: 0, wordup: 0, challenge: 0, marathon: 0 };
   }
   currentBucket.gamesCompleted.main_daily = (currentBucket.gamesCompleted.main_daily || 0) + 1;
   saveLocalBucket(currentBucket);
}

/**
 * Tracks completion of any game mode (Main Daily, WordUp, Challenge, Marathon).
 */
export function trackGameCompleted(mode: "main_daily" | "wordup" | "challenge" | "marathon"): void {
   if (!currentBucket) return;
   if (!currentBucket.gamesCompleted) {
      currentBucket.gamesCompleted = { main_daily: 0, wordup: 0, challenge: 0, marathon: 0 };
   }
   currentBucket.gamesCompleted[mode] = (currentBucket.gamesCompleted[mode] || 0) + 1;
   if (mode === "main_daily") {
      currentBucket.dailyCompleted = true;
   }
   saveLocalBucket(currentBucket);
}

/**
 * Explicitly marks notification attribution if a user opens a notification while already in the app.
 */
export function trackNotificationEngaged(): void {
   if (!currentBucket) return;
   currentBucket.openedViaNotification = true;
   currentBucket.notificationOpensCount = (currentBucket.notificationOpensCount || 0) + 1;
   saveLocalBucket(currentBucket);
}

/**
 * Tracks a click interaction on a specific section or modal.
 */
export function trackSectionClick(sectionId: string): void {
   if (!currentBucket) return;
   currentBucket.clicksPerSection[sectionId] = (currentBucket.clicksPerSection[sectionId] || 0) + 1;
   currentBucket.totalInteractions += 1;
   currentBucket.isBounce = currentBucket.timeSpentSeconds < 10 && currentBucket.totalInteractions <= 1;
   currentBucket.isGhostSuspect = false; // Real interaction confirms genuine human activity
   saveLocalBucket(currentBucket);
}

/**
 * Sets the currently active section or modal for active time tracking.
 */
export function setActiveSection(sectionId: string | null): void {
   if (!currentBucket) return;
   flushCurrentActiveSectionDuration();
   currentBucket.currentActiveSection = sectionId;
   currentBucket.sectionStartTime = sectionId ? Date.now() : null;
   if (sectionId) {
      trackSectionClick(sectionId);
   }
   saveLocalBucket(currentBucket);
}

/**
 * Manually adds time spent on a section.
 */
export function trackSectionTime(sectionId: string, durationSeconds: number): void {
   if (!currentBucket || durationSeconds <= 0) return;
   currentBucket.timeSpentPerSection[sectionId] = (currentBucket.timeSpentPerSection[sectionId] || 0) + Math.round(durationSeconds);
   saveLocalBucket(currentBucket);
}

/**
 * Explicitly triggers a flush of any pending telemetry bucket with 3 retries.
 */
export async function flushTelemetry(): Promise<boolean> {
   const bucket = loadLocalBucket();
   if (!bucket) return true;
   flushCurrentActiveSectionDuration();
   const success = await submitBucketWithRetry(bucket, 3);
   if (success && bucket.date !== getTodayStr()) {
      saveLocalBucket(null);
   }
   return success;
}

export function resetTelemetryState(): void {
   if (activeTimer) {
      clearInterval(activeTimer);
      activeTimer = null;
   }
   currentBucket = null;
}

