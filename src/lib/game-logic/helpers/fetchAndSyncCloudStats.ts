import { supabase } from "@/lib/supabaseClient";
import type { GameStats } from "@/types/game";
import { safeLocalStorage } from "@/utils/storage";
import { calculateStreak } from "@/utils/streak";

export const fetchAndSyncCloudStatsSub = async (
   userId: string,
): Promise<void> => {
   try {
      const { data: scores, error } = await supabase
         .from("scores")
         .select("status, attempts, game_date")
         .eq("user_id", userId)
         .order("game_date", { ascending: true });

      if (error) throw error;

      const { currentStreak, maxStreak } = calculateStreak(scores || []);

      const cloudStats: GameStats = {
         gamesPlayed: scores.length,
         gamesWon: 0,
         currentStreak,
         maxStreak,
         guesses: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 },
      };

      scores.forEach((game) => {
         if (game.status === "won") {
            cloudStats.gamesWon += 1;

            const attemptKey = String(game.attempts);
            if (cloudStats.guesses[attemptKey] !== undefined) {
               cloudStats.guesses[attemptKey] += 1;
            }
         }
      });

      const localRaw = safeLocalStorage.getItem("wordle-statistics");
      const localStats: GameStats | null = localRaw
         ? JSON.parse(localRaw)
         : null;

      if (localStats) {
         if (localStats.gamesPlayed > cloudStats.gamesPlayed) {
            return;
         }
      }

      safeLocalStorage.setItem("wordle-statistics", JSON.stringify(cloudStats));
      safeLocalStorage.setItem("stats_synced_v1", "true");
   } catch (err) {
      console.error("Cloud sync failed:", err);
   }
};
