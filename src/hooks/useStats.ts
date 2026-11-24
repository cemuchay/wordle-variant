import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import type { AppUser, GameStats } from "../types/game";
import { useApp } from "../context/AppContext";
import { safeLocalStorage } from "../utils/storage";
import { calculateStreak } from "@/utils/streak";
import { QUERY } from "../constants/queries";
import { checkAndGrantStreakMilestoneOnWin } from "../utils/streakAwards";

const INITIAL_STATS: GameStats = {
   gamesPlayed: 0,
   gamesWon: 0,
   currentStreak: 0,
   maxStreak: 0,
   guesses: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, X: 0 },
};

const STATS_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
let lastFetchedUserId: string | null = null;
let lastFetchedAt = 0;
let inflightStatsPromise: Promise<GameStats | null> | null = null;

export const useWordleStats = (
   user: AppUser | null,
   isOpen: boolean,
   date: string | null
) => {
   const { stats, setStats } = useApp();
   const [loading, setLoading] = useState(false);
   const isMounted = useRef(true);

   const userId = user?.id; // Break object reference for Compiler stability

   useEffect(() => {
      isMounted.current = true;
      return () => {
         isMounted.current = false;
      };
   }, []);

   /**
    * Cleanup Script: Runs on mount or user change.
    * Purges old local game data for logged-in users.
    */
   useEffect(() => {
      if (userId && date) {
         const prefix = "wordle-";
         const todayKey = `${prefix}${date}`;
         const sevenDaysAgo = Date.now() - QUERY.STALE_24H;

         safeLocalStorage.getAllKeys().forEach((key) => {
            // Remove only daily wordle keys that aren't for today
            if (
               key.startsWith(prefix) &&
               key !== todayKey &&
               key !== `${todayKey}-backup` &&
               !key.startsWith("wordle-statistics")
            ) {
               safeLocalStorage.removeItem(key);
            }

            // Remove stale challenge progression keys older than 7 days
            if (key.startsWith("challenge-prog-")) {
               try {
                  const val = safeLocalStorage.getItem(key);
                  if (val) {
                     const parsed = JSON.parse(val);
                     if (parsed.timestamp && parsed.timestamp < sevenDaysAgo) {
                        safeLocalStorage.removeItem(key);
                     }
                  } else {
                     safeLocalStorage.removeItem(key);
                  }
               } catch {
                  // Purge if corrupted or invalid JSON
                  safeLocalStorage.removeItem(key);
               }
            }
         });
      }
   }, [userId, date]);

   const fetchCloudStats = useCallback(async (force = false) => {
      if (!userId) return;

      const now = Date.now();
      if (
         !force &&
         lastFetchedUserId === userId &&
         now - lastFetchedAt < STATS_CACHE_TTL_MS
      ) {
         return;
      }

      if (!force && inflightStatsPromise && lastFetchedUserId === userId) {
         const sharedResult = await inflightStatsPromise;
         if (isMounted.current && sharedResult) {
            setStats(sharedResult);
         }
         return;
      }

      // Prevent cascading render by checking current state
      setLoading((prev) => (prev ? prev : true));
      lastFetchedUserId = userId;

      const promise = (async (): Promise<GameStats | null> => {
         const { data, error } = await supabase
            .from("scores")
            .select("status, attempts, game_date")
            .eq("user_id", userId)
            .order("game_date", { ascending: true });

         if (!error && data) {
            const constructed: GameStats = JSON.parse(
               JSON.stringify(INITIAL_STATS)
            );

            // Calculate streaks using shared date-aware function
            const { currentStreak, maxStreak } = calculateStreak(data);

            // Build guess distribution
            data.forEach((score) => {
               if (score.status === "won") {
                  const attKey = score.attempts?.toString();
                  if (attKey && constructed.guesses[attKey] !== undefined) {
                     constructed.guesses[attKey]++;
                  }
               } else if (score.status === "lost") {
                  constructed.guesses["X"]++;
               }
            });

            constructed.gamesPlayed = data.filter(
               (s) => s.status !== "playing"
            ).length;
            constructed.gamesWon = data.filter((s) => s.status === "won").length;
            constructed.currentStreak = currentStreak;
            constructed.maxStreak = maxStreak;

            if (maxStreak >= 50 && userId) {
               checkAndGrantStreakMilestoneOnWin(userId, maxStreak);
            }

            lastFetchedAt = Date.now();
            try {
               safeLocalStorage.setItem(
                  `wordle-statistics-${userId}`,
                  JSON.stringify(constructed)
               );
            } catch {
               // Ignore quota error
            }
            return constructed;
         }
         return null;
      })();

      inflightStatsPromise = promise;

      try {
         const constructed = await promise;
         if (isMounted.current && constructed) {
            setStats(constructed);
         }
      } finally {
         if (inflightStatsPromise === promise) {
            inflightStatsPromise = null;
         }
         if (isMounted.current) setLoading(false);
      }
   }, [userId, setStats]);

   // Seed stats immediately from local cache, then revalidate in background if stale
   useEffect(() => {
      if (userId) {
         try {
            const cachedUserStats = safeLocalStorage.getItem(`wordle-statistics-${userId}`);
            if (cachedUserStats) {
               setStats(JSON.parse(cachedUserStats));
            }
         } catch {
            // Ignore parse error
         }
         queueMicrotask(() => fetchCloudStats(false));
      }
   }, [userId, isOpen, fetchCloudStats, setStats]);

   // Load initial stats from local storage if no user
   useEffect(() => {
      if (!userId) {
         const raw = safeLocalStorage.getItem("wordle-statistics");
         if (raw) {
            setStats(JSON.parse(raw));
         }
      }
   }, [userId, setStats]);

   const updateOptimistically = useCallback((newStats: GameStats) => {
      setStats(newStats);
      if (userId) {
         try {
            safeLocalStorage.setItem(
               `wordle-statistics-${userId}`,
               JSON.stringify(newStats)
            );
         } catch {
            // Ignore
         }
      }
   }, [setStats, userId]);

   const forceRefresh = useCallback(() => fetchCloudStats(true), [fetchCloudStats]);

   return { stats, loading, refresh: forceRefresh, updateOptimistically };
};
