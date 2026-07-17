/* eslint-disable @typescript-eslint/no-explicit-any */
import { getEasyWords } from "../../data/easy-words";
import { loadWordLists } from "../../data/words";
import type { GuessResult, LetterStatus } from "../../types/game";
import { calculateSkillIndexSub } from "./helpers/calculateSkillIndex";
import { decryptGuessesSub } from "./helpers/decryptGuesses";
import { fetchAndSyncCloudStatsSub } from "./helpers/fetchAndSyncCloudStats";
import { getDailyConfigSub } from "./helpers/getDailyConfig";
import { getShapeShifterFeedbackAndWordSub } from "./helpers/getShapeShifterFeedbackAndWord";
import getUnconstrainedDailyConfigSub from "./helpers/getUnconstrainedDailyConfig";
import { getWordAtDateSub } from "./helpers/getWordAtDate";
import { syncGameStateSub } from "./helpers/syncGameState";
import { syncStatsFromLocalStorageSub } from "./helpers/syncStatsFromLocalStorage";
import { updateStatsSub } from "./helpers/updateStats";

/**
 * Aggregates the statuses of all letters used in the game so far.
 * This is used to drive the visual state of the on-screen keyboard (correct, present, absent).
 *
 * @param guesses - 2D array of guess results representing the current game state.
 * @returns A record mapping each letter to its highest priority status found.
 *
 * @adjustment Tip: If adding a new LetterStatus (e.g., "invalid"), update the priority logic here.
 */
export function getLetterStatuses(
   guesses: GuessResult[][],
): Record<string, LetterStatus> {
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
 * Internal helper to resolve the word and length for a specific date.
 *
 * @what Handles "Eras" of game history:
 * 1. Pre-May 3: Legacy hash, legacy word selection.
 * 2. Pre-May 11: New hash, legacy length selection (4-6 chars).
 * 3. Post-May 11: New hash, expanded length selection (3-7 chars) with weighted buckets.
 * 4. Post-June 8: 3-letter words removed, weight reallocated to 7-letter words.
 *
 * @param dateStr - ISO date string (YYYY-MM-DD).
 * @param isAuthenticated - Whether the user is logged in (affects the salt).
 * @param attempt - Iteration count for collision retries.
 *
 * @adjustment Tip: To change length distribution, adjust the 'r < X' thresholds below.
 */
export const getWordAtDate = getWordAtDateSub;

/**
 * Generates a purely random word for non-daily modes.
 *
 * @param length - Desired word length.
 * @returns A random official word in uppercase.
 */
export async function getRandomWord(
   length: number,
   difficulty?: "easy" | "normal" | "difficult",
   isChallenge = false,
): Promise<string> {
   const { official, valid } = await loadWordLists(length, isChallenge);
   let pool: string[];
   if (difficulty === "easy" && length >= 3 && length <= 5) {
      pool = getEasyWords(length);
   } else if (difficulty === "difficult" && length >= 3 && length <= 5) {
      pool = [...valid];
   } else {
      pool = official;
   }
   return pool[Math.floor(Math.random() * pool.length)].toUpperCase();
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
   const result = word
      .split("")
      .map((char, i) => {
         const charCode = char.charCodeAt(0);
         const saltCode = salt.charCodeAt(i % salt.length);
         return String.fromCharCode(charCode ^ saltCode);
      })
      .join("");
   return btoa(result);
};

/**
 * Reverses the obfuscation applied by obfuscateWord.
 *
 * @param obfuscated - Base64 encoded XOR string.
 * @param salt - Must match the salt used for obfuscation.
 */
export const deobfuscateWord = (obfuscated: string, salt: string) => {
   if (!obfuscated) return "";
   try {
      const decoded = atob(obfuscated);
      const result = decoded
         .split("")
         .map((char, i) => {
            const charCode = char.charCodeAt(0);
            const saltCode = salt.charCodeAt(i % salt.length);
            return String.fromCharCode(charCode ^ saltCode);
         })
         .join("");

      // If the result contains non-printable characters or is not within the allowed characters range,
      // it's likely already deobfuscated or the salt is wrong.
      if (/^[A-Z0-9\s.,!?'"\-()]+$/i.test(result)) {
         return result;
      }
      return obfuscated;
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
   } catch (e) {
      // If atob fails, it's definitely not obfuscated Base64.
      return obfuscated;
   }
};

/**
 * Encrypts guesses client-side using a key derived from the target word + salt.
 * Uses unicode-safe binary string encoding to prevent crashes on non-Latin1 text.
 */
export const encryptGuesses = (guesses: any[], key: string) => {
   if (!guesses) return null;
   const plaintext = JSON.stringify(guesses);
   if (!key) return plaintext;
   try {
      // Convert to UTF-8 binary string to support unicode characters securely
      const utf8String = unescape(encodeURIComponent(plaintext));
      const encrypted = btoa(
         utf8String
            .split("")
            .map((char, i) => {
               const charCode = char.charCodeAt(0);
               const keyCode = key.charCodeAt(i % key.length);
               return String.fromCharCode(charCode ^ keyCode);
            })
            .join(""),
      );
      return `enc:${encrypted}`;
   } catch (e) {
      console.error("Encryption failed:", e);
      return plaintext;
   }
};

/**
 * Decrypts guesses client-side using the key target word + salt.
 * If not encrypted (two-tier legacy support), parses as regular JSON.
 */
export const decryptGuesses = decryptGuessesSub;
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

export const getDailyConfig = getDailyConfigSub;

/**
 * Legacy unconstrained daily configuration generator.
 */
export const getUnconstrainedDailyConfig = getUnconstrainedDailyConfigSub;

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
   const foundLetters = new Set<string>();

   guesses.forEach((row) => {
      row.forEach((cell, index) => {
         if (cell.status === "correct") {
            correctIndices.add(index);
         }
         if (cell.status === "correct" || cell.status === "present") {
            foundLetters.add(cell.letter.toUpperCase());
         }
      });
   });

   const remainingIndices = targetWord
      .split("")
      .map((_, i) => i)
      .filter((i) => !correctIndices.has(i));

   const remainingCount = remainingIndices.length;
   const undiscoveredCount = remainingIndices.filter(
      (i) => !foundLetters.has(targetWord[i]),
   ).length;

   if (remainingCount <= 1) return true;
   if (remainingCount === 2 && undiscoveredCount <= 1) return true;

   return false;
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
   const foundLetters = new Set<string>();

   guesses.forEach((row) => {
      row.forEach((cell, index) => {
         if (cell.status === "correct") {
            correctIndices.add(index);
         }
         if (cell.status === "correct" || cell.status === "present") {
            foundLetters.add(cell.letter.toUpperCase());
         }
      });
   });

   const remainingIndices = targetWord
      .split("")
      .map((_, i) => i)
      .filter((i) => !correctIndices.has(i));

   // Prioritize revealing new letters (not yet discovered/guessed in target word)
   // over correct positions of yellow letters.
   const newLetterIndices = remainingIndices.filter(
      (i) => !foundLetters.has(targetWord[i]),
   );

   const candidateIndices =
      newLetterIndices.length > 0 ? newLetterIndices : remainingIndices;

   const randomIndex =
      candidateIndices[Math.floor(Math.random() * candidateIndices.length)];

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
export const updateStats = updateStatsSub;

/**
 * Migration helper for legacy storage formats.
 *
 * @what Older versions stored game results in individual 'wordle-YYYY-MM-DD' keys.
 * This crawls those keys once and aggregates them into the modern 'wordle-statistics' object.
 */
export const syncStatsFromLocalStorage = syncStatsFromLocalStorageSub;

/**
 * Cloud Sync logic for user statistics.
 *
 * @what Compares LocalStorage data with Supabase records.
 *
 * @why CONFLICT RESOLUTION: We use the source with more 'gamesPlayed' as the truth.
 * This ensures that if a user plays 5 games offline, then logs in, their
 * local progress isn't wiped by a smaller cloud dataset.
 */
export const fetchAndSyncCloudStats = fetchAndSyncCloudStatsSub;

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

export const calculateSkillIndex = calculateSkillIndexSub;

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
export const syncGameState = syncGameStateSub;
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
   payload: any,
   retries = 3,
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

/**
 * Shape Shifter Mode compatibility check.
 * Checks if a candidate word is compatible with the feedback of a past guess.
 */
export function isGuessCompatible(
   candidate: string,
   pastGuess: GuessResult[],
): boolean {
   const guessWord = pastGuess
      .map((g) => g.letter)
      .join("")
      .toUpperCase();
   const feedback = checkGuess(guessWord, candidate);
   for (let i = 0; i < feedback.length; i++) {
      if (feedback[i].status !== pastGuess[i].status) {
         return false;
      }
   }
   return true;
}

/**
 * Shape Shifter Mode shift algorithm.
 * Uses a minimax bucket partitioning strategy to select the next target word.
 */
export const getShapeShifterFeedbackAndWord = getShapeShifterFeedbackAndWordSub;
