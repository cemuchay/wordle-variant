import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import type { AppUser, GameStats } from "../types/game";
import { useApp } from "../context/AppContext";
import { safeLocalStorage } from "../utils/storage";
import { calculateStreak } from "@/utils/streak";

const INITIAL_STATS: GameStats = {
   gamesPlayed: 0,
   gamesWon: 0,
   currentStreak: 0,
   maxStreak: 0,
   guesses: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, X: 0 },
};

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

         safeLocalStorage.getAllKeys().forEach((key) => {
            // Remove only daily wordle keys that aren't for today
            if (
               key.startsWith(prefix) &&
               key !== todayKey &&
               key !== `${todayKey}-backup` &&
               key !== "wordle-statistics"
            ) {
               safeLocalStorage.removeItem(key);
            }
         });
      }
   }, [userId, date]);

   const fetchCloudStats = useCallback(async () => {
      if (!userId) return;

      // Prevent cascading render by checking current state
      setLoading((prev) => (prev ? prev : true));

      const { data, error } = await supabase
         .from("scores")
         .select("status, attempts, game_date")
         .eq("user_id", userId)
         .order("game_date", { ascending: true });

      if (isMounted.current && !error && data) {
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

         setStats(constructed);
      }

      if (isMounted.current) setLoading(false);
   }, [userId, setStats]);

   // Trigger fetch when user is present (e.g. on mount/refresh) OR when modal opens
   useEffect(() => {
      if (userId) {
         // Use a microtask to ensure we don't block the initial mount render
         queueMicrotask(() => fetchCloudStats());
      }
   }, [userId, isOpen, fetchCloudStats]);

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
   }, [setStats]);

   return { stats, loading, refresh: fetchCloudStats, updateOptimistically };
};
