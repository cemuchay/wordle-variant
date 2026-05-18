import type { GameConfig, GameStats, GuessResult, LetterStatus } from "../../types/game";
import { getWordLists } from "../../data/words";
import { supabase } from "../supabaseClient";
import { SCORING, MAX_ATTEMPTS } from "../../constants/game";

/**
 * Aggregates the statuses of all letters used in the game so far.
 * This is used to drive the visual state of the on-screen keyboard (correct, present, absent).
 * 
 * @param guesses - 2D array of guess results representing the current game state.
 * @returns A record mapping each letter to its highest priority status found.
 * 
 * @adjustment Tip: If adding a new LetterStatus (e.g., "invalid"), update the priority logic here.
 */
export function getLetterStatuses(guesses: GuessResult[][]): Record<string, LetterStatus> {
   const statuses: Record<string, LetterStatus> = {};
   guesses.forEach((row) => {
      row.forEach((res) => {
         const current = statuses[res.letter];
         if (res.status === "correct") {
            statuses[res.letter] = "correct";
         } else if (res.status === "present" && current !== "correct") {
            statuses[res.letter] = "present";
         } else if (res.status === "absent" && !current) {
            statuses[res.letter] = "absent";
         }
      });
   });
   return statuses;
}

/**
 * Mulberry32 PRNG (Pseudo-Random Number Generator).
 * 
 * @why We use this because it's lightweight and deterministic. Given the same seed, 
 * it always produces the same sequence of numbers. This ensures every user
 * gets the same daily word regardless of their device or time zone (when using server time).
 * 
 * @param seed - The numeric seed to initialize the generator.
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
const GUEST_SALT = "GFARMS_GUEST_V1";
const TRANSITION_DATE = "2026-05-03";
const LENGTH_TRANSITION_DATE = "2026-05-11";

/**
 * Legacy hashing algorithm used before May 3rd, 2026.
 * 
 * @what Simple summation of character codes.
 * @why Pre-existing games depend on this seed generation.
 * @deprecated Prone to collisions.
 */
const oldHash = (str: string) =>
   str
      .split("")
      .reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);

/**
 * Improved hashing algorithm (djb2-style) used from May 3rd, 2026.
 * 
 * @what Bitwise shifts and additions to create a unique integer from a string.
 * @why Significantly reduces seed collisions, ensuring more unique daily words.
 */
const newHash = (str: string) =>
   str
      .split("")
      .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);

/**
 * Internal helper to resolve the word and length for a specific date.
 * 
 * @what Handles "Eras" of game history:
 * 1. Pre-May 3: Legacy hash, legacy word selection.
 * 2. Pre-May 11: New hash, legacy length selection (4-6 chars).
 * 3. Post-May 11: New hash, expanded length selection (3-7 chars) with weighted buckets.
 * 
 * @param dateStr - ISO date string (YYYY-MM-DD).
 * @param isAuthenticated - Whether the user is logged in (affects the salt).
 * @param attempt - Iteration count for collision retries.
 * 
 * @adjustment Tip: To change length distribution, adjust the 'r < X' thresholds below.
 */
function getWordAtDate(dateStr: string, isAuthenticated: boolean = true, attempt = 0): string {
   const isNew = dateStr >= TRANSITION_DATE;
   const isNewLength = dateStr >= LENGTH_TRANSITION_DATE;
   const activeSalt = isAuthenticated ? SALT : GUEST_SALT;
   const seedBase = dateStr + activeSalt + (attempt > 0 ? `_retry_${attempt}` : "");

   const seed = isNew ? newHash(seedBase) : oldHash(seedBase);
   const random = mulberry32(seed);

   let length: 5 | 6 | 4 | 3 | 7;

   if (isNewLength) {
      const r = random();
      // Weighted buckets for word length variety
      length =
         r < 0.05
            ? 3 // 5% chance
            : r < 0.1
               ? 7 // 5% chance
               : r < 0.25
                  ? 4 // 15% chance
                  : r < 0.65
                     ? 5 // 35% chance
                     : 6; // 30% chance

   } else {
      length = ([4, 5, 6] as const)[Math.floor(random() * 3)];
   }

   const { official } = getWordLists(length);

   return official[Math.floor(random() * official.length)].toUpperCase();
}

/**
 * Generates a purely random word for non-daily modes.
 * 
 * @param length - Desired word length.
 * @returns A random official word in uppercase.
 */
export function getRandomWord(length: number): string {
   const { official } = getWordLists(length);
   return official[Math.floor(Math.random() * official.length)].toUpperCase();
}

/**
 * Obfuscates a word using XOR and Base64.
 * 
 * @why Prevents users from easily seeing the target word in the browser's 
 * network inspector or localStorage. Not intended for military-grade security, 
 * just to prevent "accidental" spoilers.
 * 
 * @param word - Word to hide.
 * @param salt - Secret salt for XOR.
 */
export const obfuscateWord = (word: string, salt: string) => {
   const result = word.split('').map((char, i) => {
      const charCode = char.charCodeAt(0);
      const saltCode = salt.charCodeAt(i % salt.length);
      return String.fromCharCode(charCode ^ saltCode);
   }).join('');
   return btoa(result);
};

/**
 * Reverses the obfuscation applied by obfuscateWord.
 * 
 * @param obfuscated - Base64 encoded XOR string.
 * @param salt - Must match the salt used for obfuscation.
 */
export const deobfuscateWord = (obfuscated: string, salt: string) => {
   try {
      const decoded = atob(obfuscated);
      return decoded.split('').map((char, i) => {
         const charCode = char.charCodeAt(0);
         const saltCode = salt.charCodeAt(i % salt.length);
         return String.fromCharCode(charCode ^ saltCode);
      }).join('');
   } catch (e) {
      console.error("Deobfuscation failed:", e);
      return "";
   }
};

/**
 * The primary entry point for determining today's game configuration.
 * 
 * @what Includes a collision check to ensure today's word hasn't appeared
 * in the last 14 days (prevents boring repetition).
 * 
 * @param isAuthenticated - Whether the user is logged in.
 * @param dateOverride - Optional date to fetch config for (defaults to today).
 * 
 * @adjustment Tip: Starting May 6, 2026, maxAttempts is hardcoded to 6 for 
 * consistency across all lengths. Change this if you want 3-letter words to be easier/harder.
 */
export function getDailyConfig(isAuthenticated: boolean, dateOverride?: string): GameConfig {
   const dateStr = dateOverride || new Date().toISOString().split("T")[0];

   const isNewEra = dateStr >= TRANSITION_DATE;

   // 1. If before transition, return the legacy result immediately
   if (!isNewEra) {
      const word = getWordAtDate(dateStr, isAuthenticated);
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
      history.add(getWordAtDate(prevStr, isAuthenticated));
   }

   // 3. Generate today's word with a retry loop if it exists in history
   let attempt = 0;
   let word;

   do {
      word = getWordAtDate(dateStr, isAuthenticated, attempt);
      attempt++;
   } while (history.has(word) && attempt < 50); // Safety cap

   const length = word.length as 5 | 6 | 4 | 3 | 7;

   return {
      word,
      length,
      maxAttempts: MAX_ATTEMPTS,
   };
}

/**
 * Validates a guess against the answer and determines letter colors.
 * 
 * @what This uses a standard two-pass algorithm:
 * 1. Find all 'correct' (green) letters and remove them from consideration.
 * 2. Find all 'present' (yellow) letters among what's left.
 * 
 * @why Two passes are required to handle duplicate letters correctly. 
 * If the answer is "ABBEY" and you guess "BABES", the first 'B' 
 * in BABES must be yellow, and the second 'B' must be green. One pass would 
 * incorrectly mark both as something else.
 */
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

/**
 * Determines if the hint feature should be disabled based on the "Bar 1" rule:
 * If only one letter remains to be correctly placed, hints are disabled to prevent
 * an automatic win.
 */
export const isHintDisabled = (word: string, guesses: GuessResult[][]) => {
   const targetWord = word.toUpperCase();
   const correctIndices = new Set<number>();

   guesses.forEach((row) => {
      row.forEach((cell, index) => {
         if (cell.status === "correct") {
            correctIndices.add(index);
         }
      });
   });

   const remainingCount = targetWord.length - correctIndices.size;
   return remainingCount <= 1;
};

/**
 * Determines a helpful hint for the user.
 * 
 * @what It ignores indices the user has already solved and picks one 
 * remaining unrevealed letter from the target word at random.
 * 
 * @returns {letter: string, index: number} or null if the word is already solved.
 */
export const getHint = (word: string, guesses: GuessResult[][]) => {
   if (isHintDisabled(word, guesses)) return null;

   const targetWord = word.toUpperCase();
   const correctIndices = new Set<number>();

   guesses.forEach((row) => {
      row.forEach((cell, index) => {
         if (cell.status === "correct") {
            correctIndices.add(index);
         }
      });
   });

   const remainingIndices = targetWord
      .split("")
      .map((_, i) => i)
      .filter((i) => !correctIndices.has(i));

   const randomIndex =
      remainingIndices[Math.floor(Math.random() * remainingIndices.length)];

   return {
      letter: targetWord[randomIndex],
      index: randomIndex,
   };
};

/**
 * Local-only statistics updater. 
 * 
 * @why This maintains the "Offline First" experience by ensuring stats 
 * are updated in LocalStorage immediately after a game ends.
 */
export const updateStats = (won: boolean, attempts: number): GameStats => {
   const raw = localStorage.getItem("wordle-statistics");
   const stats: GameStats = raw
      ? JSON.parse(raw)
      : {
         gamesPlayed: 0,
         gamesWon: 0,
         currentStreak: 0,
         maxStreak: 0,
         guesses: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "X": 0 },
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

   localStorage.setItem("wordle-statistics", JSON.stringify(stats));
   return stats;
};

/**
 * Migration helper for legacy storage formats. 
 * 
 * @what Older versions stored game results in individual 'wordle-YYYY-MM-DD' keys.
 * This crawls those keys once and aggregates them into the modern 'wordle-statistics' object.
 */
export const syncStatsFromLocalStorage = () => {
   if (localStorage.getItem("stats_synced_v1")) return;

   const stats: GameStats = {
      gamesPlayed: 0,
      gamesWon: 0,
      currentStreak: 0,
      maxStreak: 0,
      guesses: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, "X": 0 },
   };

   const gameKeys = Object.keys(localStorage)
      .filter((key) => /^wordle-\d{4}-\d{2}-\d{2}$/.test(key))
      .sort();

   gameKeys.forEach((key) => {
      const data = localStorage.getItem(key);
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

   localStorage.setItem("wordle-statistics", JSON.stringify(stats));
   localStorage.setItem("stats_synced_v1", "true");
};

/**
 * Cloud Sync logic for user statistics.
 * 
 * @what Compares LocalStorage data with Supabase records. 
 * 
 * @why CONFLICT RESOLUTION: We use the source with more 'gamesPlayed' as the truth.
 * This ensures that if a user plays 5 games offline, then logs in, their 
 * local progress isn't wiped by a smaller cloud dataset.
 */
export const fetchAndSyncCloudStats = async (userId: string): Promise<void> => {
   try {
      const { data: scores, error } = await supabase
         .from("scores")
         .select("status, attempts")
         .eq("user_id", userId)
         .order("game_date", { ascending: true });

      if (error) throw error;

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

      const localRaw = localStorage.getItem("wordle-statistics");
      const localStats: GameStats | null = localRaw
         ? JSON.parse(localRaw)
         : null;

      if (localStats) {
         if (localStats.gamesPlayed > cloudStats.gamesPlayed) {
            return;
         }
      }

      localStorage.setItem("wordle-statistics", JSON.stringify(cloudStats));
      localStorage.setItem("stats_synced_v1", "true");
   } catch (err) {
      console.error("Cloud sync failed:", err);
   }
};

/**
 * The Authoritative Scoring Algorithm (Skill Index).
 * 
 * @what Calculates a player's performance based on their strategic choices.
 * 
 * @why ERA TRANSITION (May 18, 2026): "Payoff + Deduction System". 
 *    - Process rows chronologically.
 *    - WINNER PAYOFF: If won, Row N awards (WordLength * 40) points.
 *    - DEDUCTIONS (Rows 1 to N-1):
 *      - Yellow: -15 (Net 25 discovery after final payoff).
 *      - Green: 0 (Net 40 discovery after final payoff).
 *      - New Absent: -5.
 *      - Repeat Absent: -20 (Strategic failure).
 *    - HINT PENALTY: -100.
 *    - LOSS: No payoff, base score is 0.
 */
export const calculateSkillIndex = ({
   attempts,
   maxAttempts,
   usedHint,
   guesses,
   targetWord,
   gameDate,
   hintRecord
}: {
   attempts: number,
   maxAttempts: number,
   usedHint: boolean,
   guesses: GuessResult[][],
   targetWord: string,
   gameDate?: string,
   hintRecord?: { index: number; letter: string } | null
}
) => {
   //REMOVE:  
   console.log(hintRecord)
   const targetDate = new Date('2026-05-18');
   const currentDate = gameDate ? new Date(gameDate) : new Date();
   const isNewSystem = currentDate >= targetDate;

   if (!isNewSystem) {
      // Legacy scoring logic for backwards compatibility
      let score = ((maxAttempts - attempts + 1) / maxAttempts) * SCORING.BASE_SCORE_MAX;
      if (usedHint) score -= SCORING.HINT_PENALTY;

      let bonus = 0;
      guesses.forEach((row) => {
         row.forEach((cell) => {
            if (cell.status === "correct") bonus += 15;
            if (cell.status === "present") bonus += 2;
            if (cell.status === "absent") bonus -= 10;
         });
      });
      return Math.floor(score + bonus);
   }

   const lastRowIdx = guesses.length - 1;
   const lastRow = guesses[lastRowIdx];
   const won = lastRow && lastRow.every(cell => cell.status === "correct");

   // 1. Base Performance (Efficiency)
   let score = 0;
   if (won) {
      score = ((maxAttempts - (lastRowIdx + 1) + 1) / maxAttempts) * SCORING.BASE_SCORE_MAX;
   }

   // 2. Hint Penalty
   if (usedHint) score -= SCORING.HINT_PENALTY;

   // 3. Discovery & Strategy Logic
   let bonus = 0;
   const knownBlacks = new Set<string>();
   const targetChars = targetWord.toUpperCase().split("");

   guesses.forEach((row, rowIdx) => {
      const isLastRow = rowIdx === lastRowIdx;

      if (isLastRow && won) {
         // THE PAYOFF: Reward all discovered entities
         bonus += targetChars.length * SCORING.POINTS_PER_LETTER;
      } else {
         // THE DEDUCTIONS: Only apply to rows before the win (or all rows if lost)
         row.forEach((cell) => {
            const letter = cell.letter.toUpperCase();

            if (cell.status === 'present') {
               bonus -= SCORING.YELLOW_PENALTY;
            } else if (cell.status === 'absent') {
               if (targetChars.includes(letter)) {
                  // Quantity mistake or known letter in wrong spot (treated as minor)
                  bonus -= SCORING.ABSENT_PENALTY;
               } else if (knownBlacks.has(letter)) {
                  bonus -= SCORING.REPEATED_ABSENT_PENALTY; // High-severity repeat mistake
               } else {
                  bonus -= SCORING.ABSENT_PENALTY; // Fresh discovery of absent letter
                  knownBlacks.add(letter);
               }
            }
            // Green in early rows (cell.status === 'correct') results in 0 deduction, netting full +40 later
         });
      }
   });

   return Math.max(0, Math.floor(score + bonus));
};

/**
 * Synchronizes a finished game state to Supabase.
 * 
 * @what Calculates the skill_score authoritativey before upserting.
 * @why This ensures the DB score always reflects the current scoring logic 
 * regardless of client-side overrides.
 * 
 * @param userId - The UUID of the authenticated user.
 * @param date - The game date (YYYY-MM-DD).
 * @param payload - The complete game state object.
 */
export const syncGameState = async (
   userId: string,
   date: string | null,
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   payload: any
) => {
   if (!date) return;
   const isGameOver = payload.status !== "playing";

   const skillScore = isGameOver
      ? calculateSkillIndex({
         attempts: payload.guesses.length,
         maxAttempts: payload.config.maxAttempts,
         usedHint: payload.usedHint,
         guesses: payload.guesses,
         gameDate: date,
         hintRecord: payload.hintRecord,
         targetWord: payload.config.word || payload.config.targetWord,
      })
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
         skill_score: skillScore,
         attempts: payload.guesses.length,
         game_message: payload.gameMessage,
      },
      { onConflict: "user_id, game_date" }
   );

   if (error) {
      console.error("Cloud sync failed:", error.message);
      throw error;
   }
   return skillScore;
};

/**
 * Wrapper for syncGameState that provides automatic retry logic.
 * 
 * @why Useful for handling intermittent network failures during the critical save phase.
 * 
 * @param retries - Number of times to attempt the sync before giving up.
 */
export const syncWithRetry = async (
   userId: string,
   date: string | null,
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   payload: any,
   retries = 3
): Promise<{ success: boolean; score: number }> => {
   if (!date) return { success: false, score: 0 };
   for (let i = 0; i < retries; i++) {
      try {
         const score = await syncGameState(userId, date, payload);
         return { success: true, score: score || 0 };
      } catch (err) {
         if (i === retries - 1) throw err;
         await new Promise((resolve) => setTimeout(resolve, 1000));
      }
   }
   return { success: false, score: 0 };
};
