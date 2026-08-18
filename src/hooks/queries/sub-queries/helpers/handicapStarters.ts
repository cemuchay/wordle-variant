import { loadWordLists } from "@/data/words";
import { checkGuess } from "@/lib/game-logic";
import getMatchCount from "./getMatchCount";

export type HandicapLevel = "easy" | "normal" | "difficult";
export type HandicapRows = 1 | 2;

interface StarterCandidateScore {
   word: string;
   greenCount: number;
   yellowCount: number;
   totalMatches: number;
   remainingPoolSize: number;
   score: number;
}

/**
 * Filter pool of candidate words that match the feedback from a guess against the target.
 */
export function filterRemainingPool(
   pool: string[],
   guess: string,
   target: string,
): string[] {
   const feedback = checkGuess(guess, target);
   const statuses = feedback.map((f) => f.status);
   const L = target.length;

   return pool.filter((candidate) => {
      if (candidate.length !== L) return false;

      // 1. Positional check
      for (let i = 0; i < L; i++) {
         if (statuses[i] === "correct" && candidate[i] !== guess[i]) return false;
         if (statuses[i] === "present" && candidate[i] === guess[i]) return false;
      }

      // 2. Letter frequency checks
      const charCounts: Record<string, { required: number; exact: boolean }> = {};
      for (let i = 0; i < L; i++) {
         const char = guess[i];
         if (!charCounts[char]) {
            charCounts[char] = { required: 0, exact: false };
         }
         if (statuses[i] === "correct" || statuses[i] === "present") {
            charCounts[char].required += 1;
         } else if (statuses[i] === "absent") {
            charCounts[char].exact = true;
         }
      }

      for (const [char, req] of Object.entries(charCounts)) {
         let countInCand = 0;
         for (let i = 0; i < L; i++) {
            if (candidate[i] === char) countInCand++;
         }
         if (countInCand < req.required) return false;
         if (req.exact && countInCand !== req.required) return false;
      }

      return true;
   });
}

/**
 * Computes the handicap starter word based on the chosen level (easy, normal, difficult).
 */
export async function pickHandicapStarter({
   target,
   length,
   level,
   candidatePool,
   avoidWords = new Set<string>(),
}: {
   target: string;
   length: number;
   level: HandicapLevel;
   candidatePool?: string[];
   avoidWords?: Set<string>;
}): Promise<string> {
   const upperTarget = target.toUpperCase();
   let pool = candidatePool;
   if (!pool || pool.length === 0) {
      const { official, valid } = await loadWordLists(length, true);
      pool = official && official.length > 0 ? official : Array.from(valid);
   }

   const filteredPool = pool.filter(
      (w) => w.length === length && w.toUpperCase() !== upperTarget && !avoidWords.has(w.toUpperCase()),
   );

   if (filteredPool.length === 0) {
      return pool[0] || "CRANE";
   }

   if (level === "normal") {
      // Normal mode: pick random starter with match count constraints
      const maxAllowed = length <= 4 ? 1 : 3;
      let starter = filteredPool[Math.floor(Math.random() * filteredPool.length)].toUpperCase();
      let limit = 0;
      while (limit < 200) {
         if (
            starter !== upperTarget &&
            !avoidWords.has(starter) &&
            getMatchCount(starter, upperTarget) <= maxAllowed
         ) {
            return starter;
         }
         starter = filteredPool[Math.floor(Math.random() * filteredPool.length)].toUpperCase();
         limit++;
      }
      return starter;
   }

   if (level === "difficult") {
      // Difficult mode: worst starter that does minimal help.
      // Prioritize 0 greens, 0 yellows, minimum pool reduction, and infrequent letters.
      const scored: StarterCandidateScore[] = [];
      const sampleSize = Math.min(filteredPool.length, 300);
      const step = Math.max(1, Math.floor(filteredPool.length / sampleSize));

      for (let i = 0; i < filteredPool.length; i += step) {
         const word = filteredPool[i].toUpperCase();
         if (word === upperTarget || avoidWords.has(word)) continue;

         const feedback = checkGuess(word, upperTarget);
         const greenCount = feedback.filter((f) => f.status === "correct").length;
         const yellowCount = feedback.filter((f) => f.status === "present").length;
         const totalMatches = greenCount + yellowCount;

         // We want minimal matches (ideally 0 green, 0 yellow)
         // And we want the remaining pool to be as large as possible (minimal elimination)
         const remaining = filterRemainingPool(filteredPool, word, upperTarget).length;

         // Score penalty for matches and pool reduction
         // Higher remaining pool + fewer matches = better for 'difficult'
         const score = remaining * 10 - greenCount * 500 - yellowCount * 150;

         scored.push({
            word,
            greenCount,
            yellowCount,
            totalMatches,
            remainingPoolSize: remaining,
            score,
         });
      }

      if (scored.length > 0) {
         scored.sort((a, b) => b.score - a.score);
         // Pick from the top worst starters
         const topWorst = scored.slice(0, Math.min(5, scored.length));
         return topWorst[Math.floor(Math.random() * topWorst.length)].word;
      }

      return filteredPool[0].toUpperCase();
   }

   // Easy mode:
   // Narrows down the remaining pool significantly, but strictly calibrated
   // so that user doesn't trivially solve on guess 2 (leaves at least >= 4 candidates when pool permits,
   // caps green letters <= Math.floor(length / 2)).
   const scoredEasy: StarterCandidateScore[] = [];
   const maxGreenAllowed = Math.max(1, Math.min(2, Math.floor(length / 2)));
   const sampleSize = Math.min(filteredPool.length, 300);
   const step = Math.max(1, Math.floor(filteredPool.length / sampleSize));

   for (let i = 0; i < filteredPool.length; i += step) {
      const word = filteredPool[i].toUpperCase();
      if (word === upperTarget || avoidWords.has(word)) continue;

      const feedback = checkGuess(word, upperTarget);
      const greenCount = feedback.filter((f) => f.status === "correct").length;
      const yellowCount = feedback.filter((f) => f.status === "present").length;
      const totalMatches = greenCount + yellowCount;

      if (greenCount > maxGreenAllowed) continue;

      const remaining = filterRemainingPool(filteredPool, word, upperTarget).length;

      // Calibration: We want significant reduction, but we don't want remaining pool <= 3
      // which would allow an instant win on guess 2.
      let penalty = 0;
      if (remaining <= 2 && filteredPool.length > 5) {
         penalty = 1000; // Too revealing
      } else if (remaining <= 3 && filteredPool.length > 8) {
         penalty = 500;
      }

      // We want high reduction (low remaining) + good match hints (1-2 yellows/greens)
      const score = (filteredPool.length - remaining) * 5 + (greenCount * 20 + yellowCount * 15) - penalty;

      scoredEasy.push({
         word,
         greenCount,
         yellowCount,
         totalMatches,
         remainingPoolSize: remaining,
         score,
      });
   }

   if (scoredEasy.length > 0) {
      scoredEasy.sort((a, b) => b.score - a.score);
      const topEasy = scoredEasy.slice(0, Math.min(5, scoredEasy.length));
      return topEasy[Math.floor(Math.random() * topEasy.length)].word;
   }

   return filteredPool[0].toUpperCase();
}

/**
 * Orchestrates handicap starters generation for single word or marathon challenges.
 */
export async function generateHandicapStarters({
   targetWord,
   length,
   marathonGames,
   plainMarathonTargets,
   handicapLevel = "normal",
   handicapRows = 1,
}: {
   targetWord?: string;
   length: number;
   marathonGames?: number[] | null;
   plainMarathonTargets?: Record<number, string>;
   handicapLevel?: HandicapLevel;
   handicapRows?: HandicapRows;
}): Promise<{
   finalHandicapStarter: string | string[] | null;
   finalHandicapStarters: (string | string[])[] | null;
}> {
   if (marathonGames && marathonGames.length > 0) {
      const startersList: (string | string[])[] = [];

      for (let idx = 0; idx < marathonGames.length; idx++) {
         const l = marathonGames[idx];
         const target = (plainMarathonTargets && plainMarathonTargets[idx]) || "WORDS";
         const { official, valid } = await loadWordLists(l, true);
         const pool = official && official.length > 0 ? official : Array.from(valid);

         const avoidWords = new Set<string>();
         const row1 = await pickHandicapStarter({
            target,
            length: l,
            level: handicapLevel,
            candidatePool: pool,
            avoidWords,
         });
         avoidWords.add(row1);

         if (handicapRows === 2) {
            // For row 2, evaluate with row 1 feedback in mind if easy
            const remainingPoolAfterRow1 = filterRemainingPool(pool, row1, target);
            const row2Pool = remainingPoolAfterRow1.length > 4 ? remainingPoolAfterRow1 : pool;

            const row2 = await pickHandicapStarter({
               target,
               length: l,
               level: handicapLevel,
               candidatePool: row2Pool,
               avoidWords,
            });
            startersList.push([row1, row2]);
         } else {
            startersList.push(row1);
         }
      }

      return {
         finalHandicapStarter: null,
         finalHandicapStarters: startersList,
      };
   }

   // Single word challenge
   const target = targetWord || "WORDS";
   const actualLength = length === 0 ? target.length : length;
   const { official, valid } = await loadWordLists(actualLength, true);
   const pool = official && official.length > 0 ? official : Array.from(valid);

   const avoidWords = new Set<string>();
   const row1 = await pickHandicapStarter({
      target,
      length: actualLength,
      level: handicapLevel,
      candidatePool: pool,
      avoidWords,
   });
   avoidWords.add(row1);

   if (handicapRows === 2) {
      const remainingPoolAfterRow1 = filterRemainingPool(pool, row1, target);
      const row2Pool = remainingPoolAfterRow1.length > 4 ? remainingPoolAfterRow1 : pool;

      const row2 = await pickHandicapStarter({
         target,
         length: actualLength,
         level: handicapLevel,
         candidatePool: row2Pool,
         avoidWords,
      });

      return {
         finalHandicapStarter: [row1, row2],
         finalHandicapStarters: null,
      };
   }

   return {
      finalHandicapStarter: row1,
      finalHandicapStarters: null,
   };
}
