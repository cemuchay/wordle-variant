/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GameConfig } from "../types/game";
import { safeLocalStorage } from "./storage";
import { obfuscateWord, deobfuscateWord } from "../lib/game-logic";
import { getLocalSalt } from "../hooks/useGameEngine/utils";
import { MAX_ATTEMPTS } from "../constants/game";

export const TRUSTED_DEVICE_KEY = "variant_trusted_device_v1";
export const TRUSTED_DEVICE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface TrustedUserSnapshot {
   id: string;
   email?: string;
   user_metadata?: Record<string, any>;
   app_metadata?: Record<string, any>;
   aud?: string;
   created_at?: string;
   updated_at?: string;
}

export interface TrustedDeviceStamp {
   version: 1;
   lastVerifiedAt: number;
   date: string;
   isAuthenticated: boolean;
   user: TrustedUserSnapshot | null;
   guestOptedIn: boolean;
}

/**
 * Deterministically formats a Date into YYYY-MM-DD in Africa/Lagos (WAT) timezone.
 */
export function getLagosDateSync(now: Date = new Date()): string {
   try {
      return new Intl.DateTimeFormat("en-CA", {
         timeZone: "Africa/Lagos",
         year: "numeric",
         month: "2-digit",
         day: "2-digit",
      }).format(now);
   } catch {
      return now.toISOString().split("T")[0];
   }
}

/**
 * Attempts to read a Supabase auth user synchronously from localStorage (`sb-*-auth-token`)
 * if present and not expired.
 */
export function getSupabaseStoredUserSync(): TrustedUserSnapshot | null {
   try {
      const keys = safeLocalStorage.getAllKeys();
      for (const key of keys) {
         if (key.startsWith("sb-") && key.endsWith("-auth-token")) {
            const raw = safeLocalStorage.getItem(key);
            if (!raw) continue;
            const parsed = JSON.parse(raw);
            const user = parsed?.user || parsed?.currentSession?.user || null;
            if (user && typeof user.id === "string") {
               return {
                  id: user.id,
                  email: user.email,
                  user_metadata: user.user_metadata || {},
                  app_metadata: user.app_metadata || {},
                  aud: user.aud || "authenticated",
                  created_at: user.created_at,
                  updated_at: user.updated_at,
               };
            }
         }
      }
   } catch {
      // Ignore parse errors
   }
   return null;
}

/**
 * Returns the TrustedDeviceStamp if the device was verified within the last 24 hours.
 * Returns null if first visit, expired (>24h), or invalid.
 */
export function getTrustedDeviceStamp(
   nowMs: number = Date.now(),
): TrustedDeviceStamp | null {
   try {
      const raw = safeLocalStorage.getItem(TRUSTED_DEVICE_KEY);
      if (raw) {
         const parsed = JSON.parse(raw) as TrustedDeviceStamp;
         if (
            parsed &&
            parsed.version === 1 &&
            typeof parsed.lastVerifiedAt === "number" &&
            nowMs - parsed.lastVerifiedAt >= 0 &&
            nowMs - parsed.lastVerifiedAt <= TRUSTED_DEVICE_TTL_MS
         ) {
            return parsed;
         }
         return null;
      }

      // Seamless upgrade path: check legacy `wordle_last_hydrated_timestamp` (format: YYYY-MM-DD_epochMs)
      const legacyTs = safeLocalStorage.getItem("wordle_last_hydrated_timestamp");
      if (legacyTs && legacyTs.includes("_")) {
         const [datePart, tsPart] = legacyTs.split("_");
         const verifiedAt = Number(tsPart);
         if (
            !Number.isNaN(verifiedAt) &&
            nowMs - verifiedAt >= 0 &&
            nowMs - verifiedAt <= TRUSTED_DEVICE_TTL_MS
         ) {
            const storedUser = getSupabaseStoredUserSync();
            const guestOptedIn =
               safeLocalStorage.getItem("wordle_guest_opted_in") === "true";
            if (storedUser || guestOptedIn) {
               return {
                  version: 1,
                  lastVerifiedAt: verifiedAt,
                  date: datePart || getLagosDateSync(new Date(nowMs)),
                  isAuthenticated: Boolean(storedUser),
                  user: storedUser,
                  guestOptedIn,
               };
            }
         }
      }
   } catch {
      // Corrupted stamp
   }
   return null;
}

/**
 * Returns true if the current device has a valid <24h Trusted Device stamp.
 */
export function isTrustedDeviceBoot(nowMs: number = Date.now()): boolean {
   return getTrustedDeviceStamp(nowMs) !== null;
}

/**
 * Writes or updates the 24-hour Trusted Device stamp synchronously in localStorage.
 */
export function saveTrustedDeviceStamp(
   partial: Partial<Omit<TrustedDeviceStamp, "version" | "lastVerifiedAt">> & {
      nowMs?: number;
   } = {},
): TrustedDeviceStamp {
   const nowMs = partial.nowMs ?? Date.now();
   const existing = getTrustedDeviceStamp(nowMs);
   const storedUser =
      partial.user !== undefined
         ? partial.user
         : existing?.user ?? getSupabaseStoredUserSync();
   const isAuthenticated =
      partial.isAuthenticated !== undefined
         ? partial.isAuthenticated
         : Boolean(storedUser);
   const guestOptedIn =
      partial.guestOptedIn !== undefined
         ? partial.guestOptedIn
         : existing?.guestOptedIn ??
           safeLocalStorage.getItem("wordle_guest_opted_in") === "true";

   const nextStamp: TrustedDeviceStamp = {
      version: 1,
      lastVerifiedAt: nowMs,
      date: partial.date || existing?.date || getLagosDateSync(new Date(nowMs)),
      isAuthenticated,
      user: isAuthenticated ? storedUser : null,
      guestOptedIn,
   };

   try {
      safeLocalStorage.setItem(TRUSTED_DEVICE_KEY, JSON.stringify(nextStamp));
   } catch {
      // Ignore quota errors
   }

   return nextStamp;
}

/**
 * Clears the Trusted Device stamp (e.g., on explicit user sign-out).
 */
export function clearTrustedDeviceStamp(): void {
   try {
      safeLocalStorage.removeItem(TRUSTED_DEVICE_KEY);
   } catch {
      // Ignore
   }
}

const getDailyConfigStorageKey = (date: string, isAuthenticated: boolean) =>
   `variant_daily_config_${date}_${isAuthenticated ? "auth" : "guest"}`;

/**
 * Synchronously retrieves today's cached GameConfig if available in localStorage.
 */
export function getCachedDailyConfigSync(
   date: string,
   isAuthenticated: boolean,
   userId?: string,
): GameConfig | null {
   if (!date) return null;
   const localSalt = getLocalSalt(date, userId);

   // 1. Check dedicated daily config key
   try {
      const key = getDailyConfigStorageKey(date, isAuthenticated);
      const raw = safeLocalStorage.getItem(key);
      if (raw) {
         const parsed = JSON.parse(raw);
         if (parsed && typeof parsed.word === "string" && parsed.length) {
            const word = deobfuscateWord(parsed.word, localSalt);
            if (word && word.length === parsed.length) {
               return {
                  word,
                  length: parsed.length,
                  maxAttempts: parsed.maxAttempts || MAX_ATTEMPTS,
               };
            }
         }
      }
   } catch {
      // Fall through
   }

   // 2. Fallback: Check today's saved game state `wordle-${date}`
   try {
      const savedGameRaw = safeLocalStorage.getItem(`wordle-${date}`);
      if (savedGameRaw) {
         const payload = JSON.parse(savedGameRaw);
         const savedIsGuest = Boolean(payload?.isGuest);
         if (savedIsGuest === !isAuthenticated && payload?.config?.word) {
            const word = deobfuscateWord(payload.config.word, localSalt);
            if (word) {
               return {
                  word,
                  length: payload.config.length || word.length,
                  maxAttempts: payload.config.maxAttempts || MAX_ATTEMPTS,
               };
            }
         }
      }
   } catch {
      // Ignore parse errors
   }

   return null;
}

/**
 * Synchronously persists today's resolved GameConfig (with obfuscated word) for 0ms future boots.
 */
export function saveCachedDailyConfigSync(
   date: string,
   isAuthenticated: boolean,
   userId: string | undefined,
   config: GameConfig,
): void {
   if (!date || !config?.word) return;
   try {
      const localSalt = getLocalSalt(date, userId);
      const key = getDailyConfigStorageKey(date, isAuthenticated);
      const obfuscatedPayload = {
         word: obfuscateWord(config.word, localSalt),
         length: config.length,
         maxAttempts: config.maxAttempts || MAX_ATTEMPTS,
         savedAt: Date.now(),
      };
      safeLocalStorage.setItem(key, JSON.stringify(obfuscatedPayload));
   } catch {
      // Ignore storage write errors
   }
}
