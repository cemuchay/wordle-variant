import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "../lib/supabaseClient";
import type { AppUser, GameStats } from "../types/game";

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
   const [cloudStats, setCloudStats] = useState<GameStats | null>(null);
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

         Object.keys(localStorage).forEach((key) => {
            // Remove only daily wordle keys that aren't for today
            if (
               key.startsWith(prefix) &&
               key !== todayKey &&
               key !== "wordle-statistics"
            ) {
               localStorage.removeItem(key);
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

         // Calculate streaks and distribution from cloud history
         let current = 0;
         let max = 0;

         data.forEach((score) => {
            if (score.status === "won") {
               current++;
               const attKey = score.attempts?.toString();
               if (attKey && constructed.guesses[attKey] !== undefined) {
                  constructed.guesses[attKey]++;
               }
            } else if (score.status === "lost") {
               current = 0;
               constructed.guesses["X"]++;
            }
            if (current > max) max = current;
         });

         constructed.gamesPlayed = data.filter(
            (s) => s.status !== "playing"
         ).length;
         constructed.gamesWon = data.filter((s) => s.status === "won").length;
         constructed.currentStreak = current;
         constructed.maxStreak = max;

         setCloudStats(constructed);
      }

      if (isMounted.current) setLoading(false);
   }, [userId]);

   // Trigger fetch when modal opens
   useEffect(() => {
      if (isOpen && userId) {
         // Use a microtask to ensure we don't block the initial mount render
         queueMicrotask(() => fetchCloudStats());
      }
   }, [isOpen, userId, fetchCloudStats]);

   const stats = useMemo(() => {
      if (userId && cloudStats) return cloudStats;

      const raw = localStorage.getItem("wordle-statistics");
      return raw ? JSON.parse(raw) : INITIAL_STATS;
   }, [userId, cloudStats]);

   return { stats, loading, refresh: fetchCloudStats };
};
