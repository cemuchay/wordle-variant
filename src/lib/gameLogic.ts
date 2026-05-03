import type { GameConfig, GameStats, GuessResult } from "../types/game";
import { getWordLists } from "../data/words";
import { supabase } from "./supabaseClient";

/**
 * Mulberry32 PRNG
 * Ensures that even small date changes produce a massive "jump" in the word index.
 */
const mulberry32 = (seed: number) => {
   return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
   };
};

const SALT = "GFARMS_BETA_V2";
const TRANSITION_DATE = "2026-05-03";

/**
 * Hashing Algorithms
 */
const oldHash = (str: string) =>
   str
      .split("")
      .reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);

const newHash = (str: string) =>
   str
      .split("")
      .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);

/**
 * Internal helper to get the word for any specific date
 * based on the algorithm active at that time.
 */
function getWordAtDate(dateStr: string, attempt = 0): string {
   const isNew = dateStr >= TRANSITION_DATE;
   const seedBase = dateStr + SALT + (attempt > 0 ? `_retry_${attempt}` : "");

   const seed = isNew ? newHash(seedBase) : oldHash(seedBase);
   const random = mulberry32(seed);

   const length = ([4, 5, 6] as const)[Math.floor(random() * 3)];
   const { official } = getWordLists(length);

   return official[Math.floor(random() * official.length)].toUpperCase();
}

export function getDailyConfig(dateOverride?: string): GameConfig {
   const dateStr = dateOverride || new Date().toISOString().split("T")[0];
   const isNewEra = dateStr >= TRANSITION_DATE;

   // 1. If before transition, return the legacy result immediately
   if (!isNewEra) {
      const word = getWordAtDate(dateStr);
      const length = word.length as 4 | 6 | 5;
      return { word, length, maxAttempts: length + 1 };
   }

   // 2. New Algorithm: Check previous 14 days for collisions
   const history = new Set<string>();
   const cursor = new Date(dateStr);

   for (let i = 1; i <= 14; i++) {
      const prevDate = new Date(cursor);
      prevDate.setDate(cursor.getDate() - i);
      const prevStr = prevDate.toISOString().split("T")[0];
      history.add(getWordAtDate(prevStr));
   }

   // 3. Generate today's word with a retry loop if it exists in history
   let attempt = 0;
   let word;

   do {
      word = getWordAtDate(dateStr, attempt);
      attempt++;
   } while (history.has(word) && attempt < 50); // Safety cap

   const length = word.length as 5 | 6 | 4;

   return {
      word,
      length,
      maxAttempts: length + 1,
   };
}

export function checkGuess(guess: string, answer: string): GuessResult[] {
   const result: GuessResult[] = Array(answer.length)
      .fill(null)
      .map(() => ({ letter: "", status: "absent" }));
   const answerArray = answer.split("");
   const guessArray = guess.split("");

   // First pass: Find Corrects
   guessArray.forEach((char, i) => {
      if (char === answerArray[i]) {
         result[i] = { letter: char, status: "correct" };
         answerArray[i] = ""; // Mark as used
      }
   });

   // Second pass: Find Presents
   guessArray.forEach((char, i) => {
      if (result[i].status !== "correct" && answerArray.includes(char)) {
         result[i] = { letter: char, status: "present" };
         answerArray[answerArray.indexOf(char)] = ""; // Mark as used
      } else if (result[i].status !== "correct") {
         result[i] = { letter: char, status: "absent" };
      }
   });

   return result;
}

export const getHint = (word: string, guesses: GuessResult[][]) => {
   const targetWord = word.toUpperCase();

   // Find indices where the user has ALREADY found the correct letter
   const correctIndices = new Set<number>();

   guesses.forEach((row) => {
      row.forEach((cell, index) => {
         if (cell.status === "correct") {
            correctIndices.add(index);
         }
      });
   });

   // Find indices that haven't been solved yet
   const remainingIndices = targetWord
      .split("")
      .map((_, i) => i)
      .filter((i) => !correctIndices.has(i));

   if (remainingIndices.length === 0) return null;

   // Pick a random unrevealed index
   const randomIndex =
      remainingIndices[Math.floor(Math.random() * remainingIndices.length)];

   return {
      letter: targetWord[randomIndex],
      index: randomIndex,
   };
};

export const updateStats = (won: boolean, attempts: number) => {
   const raw = localStorage.getItem("wordle-statistics");
   const stats = raw
      ? JSON.parse(raw)
      : {
           gamesPlayed: 0,
           gamesWon: 0,
           currentStreak: 0,
           maxStreak: 0,
           guesses: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0 },
        };

   stats.gamesPlayed += 1;
   if (won) {
      stats.gamesWon += 1;
      stats.currentStreak += 1;
      stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
      stats.guesses[attempts] += 1;
   } else {
      stats.currentStreak = 0;
   }

   localStorage.setItem("wordle-statistics", JSON.stringify(stats));
};

export const syncStatsFromLocalStorage = () => {
   // Check if we've already done the big migration
   if (localStorage.getItem("stats_synced_v1")) return;

   const stats = {
      gamesPlayed: 0,
      gamesWon: 0,
      currentStreak: 0,
      maxStreak: 0,
      guesses: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 },
   };

   // 1. Find all keys that match your date pattern
   const gameKeys = Object.keys(localStorage)
      .filter((key) => /^wordle-\d{4}-\d{2}-\d{2}$/.test(key))
      .sort(); // Sort by date to calculate streak correctly

   gameKeys.forEach((key) => {
      const data = localStorage.getItem(key);
      if (!data) return;

      try {
         const game = JSON.parse(data);
         if (game.status === "playing") return; // Don't count unfinished games

         stats.gamesPlayed += 1;

         if (game.status === "won") {
            stats.gamesWon += 1;
            stats.currentStreak += 1;
            stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);

            // Use the number of rows in the guesses array
            const attemptCount = game.guesses.length;
            stats.guesses[attemptCount as keyof typeof stats.guesses] += 1;
         } else {
            // If they lost or it's a "lost" status, streak resets
            stats.currentStreak = 0;
         }
      } catch (e) {
         console.error("Error parsing game data for key:", key, e);
      }
   });

   // 2. Save the aggregated stats
   localStorage.setItem("wordle-statistics", JSON.stringify(stats));

   // 3. Mark as synced so we don't recalculate the whole history on every load
   localStorage.setItem("stats_synced_v1", "true");
};

/**
 * Fetches all user scores from Supabase and aggregates them into a
 * Wordle-standard statistics object.
 */
export const fetchAndSyncCloudStats = async (userId: string): Promise<void> => {
   try {
      const { data: scores, error } = await supabase
         .from("scores")
         .select("status, attempts")
         .eq("user_id", userId)
         .order("game_date", { ascending: true });

      if (error) throw error;

      // 1. Aggregate Cloud Data
      const cloudStats: GameStats = {
         gamesPlayed: scores.length,
         gamesWon: 0,
         currentStreak: 0,
         maxStreak: 0,
         guesses: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0 },
      };

      scores.forEach((game) => {
         if (game.status === "won") {
            cloudStats.gamesWon += 1;
            cloudStats.currentStreak += 1;
            cloudStats.maxStreak = Math.max(
               cloudStats.maxStreak,
               cloudStats.currentStreak
            );

            const attemptKey = String(game.attempts);
            if (cloudStats.guesses[attemptKey] !== undefined) {
               cloudStats.guesses[attemptKey] += 1;
            }
         } else {
            cloudStats.currentStreak = 0;
         }
      });

      // 2. Handle Conflict with Local Storage
      const localRaw = localStorage.getItem("wordle-statistics");
      const localStats: GameStats | null = localRaw
         ? JSON.parse(localRaw)
         : null;

      if (localStats) {
         // Conflict Resolution: Use the version with more gameplay data
         // This protects against data loss if the user played offline
         if (localStats.gamesPlayed > cloudStats.gamesPlayed) {
            console.log("Local progress is ahead. Keeping local stats.");
            return;
         }
      }

      // 3. Save Cloud as the new Local Source of Truth
      localStorage.setItem("wordle-statistics", JSON.stringify(cloudStats));
      localStorage.setItem("stats_synced_v1", "true");
   } catch (err) {
      console.error("Cloud sync failed:", err);
   }
};

export const calculateSkillIndex = (
   attempts: number,
   maxAttempts: number,
   usedHint: boolean,
   guesses: Record<string, string>[][]
) => {
   // Base score: 1000 for 1st try, 800 for 2nd, etc.
   let score = ((maxAttempts - attempts + 1) / maxAttempts) * 1000;

   // Penalty for being a scrub
   if (usedHint) score -= 200;

   // Precision weights
   let bonus = 0;

   guesses.forEach((row) => {
      row.forEach((cell) => {
         if (cell.status === "correct") bonus += 15;
         if (cell.status === "present") bonus += 2;
         if (cell.status === "absent") bonus -= 10;
      });
   });

   return Math.floor(score + bonus);
};

export const syncGameState = async (
   userId: string,
   date: string | null,
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   payload: any
) => {
   if (!date) return;
   const isGameOver = payload.status !== "playing";

   // Only calculate score if the game is actually over
   const skillScore = isGameOver
      ? calculateSkillIndex(
           payload.guesses.length,
           payload.config.maxAttempts,
           payload.usedHint,
           payload.guesses
        )
      : 0;

   const { error } = await supabase.from("scores").upsert(
      {
         user_id: userId,
         game_date: date,
         guesses: payload.guesses,
         status: payload.status,
         hints_used: payload.usedHint,
         hint_record: payload.hintRecord,
         word_length: payload.config.length,
         skill_score: skillScore, // Authoritative score
         attempts: payload.guesses.length,
      },
      { onConflict: "user_id, game_date" }
   );

   if (error) console.error("Cloud sync failed:", error.message);
   return skillScore;
};
