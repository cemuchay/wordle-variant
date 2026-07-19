import { networkGate } from '../../networkGate';
import type { GameStats } from "@/types/game";
import { safeLocalStorage } from "@/utils/storage";
import { calculateStreak } from "@/utils/streak";

export const fetchAndSyncCloudStatsSub = async (
   userId: string,
): Promise<void> => {
   try {
      const rawScores = await networkGate.enqueue(
         'fetch_scores_for_stats',
         {
            type: 'supabase',
            table: 'scores',
            operation: 'select',
            payload: { select: 'status, attempts, game_date' },
            query: {
               eq: { user_id: userId }
            }
         },
         true // blocking
      );

      const scores = [...(rawScores || [])].sort((a, b) => a.game_date.localeCompare(b.game_date));

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
