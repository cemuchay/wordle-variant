import type { GameStats } from "@/types/game";
import { safeLocalStorage } from "@/utils/storage";

export const updateStatsSub = (won: boolean, attempts: number): GameStats => {
   const raw = safeLocalStorage.getItem("wordle-statistics");
   const stats: GameStats = raw
      ? JSON.parse(raw)
      : {
           gamesPlayed: 0,
           gamesWon: 0,
           currentStreak: 0,
           maxStreak: 0,
           guesses: {
              "1": 0,
              "2": 0,
              "3": 0,
              "4": 0,
              "5": 0,
              "6": 0,
              "7": 0,
              X: 0,
           },
        };

   if (stats.guesses["X"] === undefined) {
      stats.guesses["X"] = 0;
   }

   stats.gamesPlayed += 1;
   if (won) {
      stats.gamesWon += 1;
      stats.currentStreak += 1;
      stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
      stats.guesses[attempts] += 1;
   } else {
      stats.currentStreak = 0;
      stats.guesses["X"] += 1;
   }

   safeLocalStorage.setItem("wordle-statistics", JSON.stringify(stats));
   return stats;
};
