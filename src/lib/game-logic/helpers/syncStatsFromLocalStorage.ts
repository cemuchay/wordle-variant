import type { GameStats } from "@/types/game";
import { safeLocalStorage } from "@/utils/storage";

export const syncStatsFromLocalStorageSub = () => {
   if (safeLocalStorage.getItem("stats_synced_v1")) return;

   const stats: GameStats = {
      gamesPlayed: 0,
      gamesWon: 0,
      currentStreak: 0,
      maxStreak: 0,
      guesses: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, X: 0 },
   };

   const gameKeys = safeLocalStorage
      .getAllKeys()
      .filter((key) => /^wordle-\d{4}-\d{2}-\d{2}$/.test(key))
      .sort();

   gameKeys.forEach((key) => {
      const data = safeLocalStorage.getItem(key);
      if (!data) return;

      try {
         const game = JSON.parse(data);
         if (game.status === "playing") return;

         stats.gamesPlayed += 1;

         if (game.status === "won") {
            stats.gamesWon += 1;
            stats.currentStreak += 1;
            stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);

            const attemptCount = String(game.guesses.length);
            if (stats.guesses[attemptCount] !== undefined) {
               stats.guesses[attemptCount] += 1;
            }
         } else if (game.status === "lost") {
            stats.currentStreak = 0;
            stats.guesses["X"] += 1;
         } else {
            stats.currentStreak = 0;
         }
      } catch (e) {
         console.error("Error parsing game data for key:", key, e);
      }
   });

   safeLocalStorage.setItem("wordle-statistics", JSON.stringify(stats));
   safeLocalStorage.setItem("stats_synced_v1", "true");
};
