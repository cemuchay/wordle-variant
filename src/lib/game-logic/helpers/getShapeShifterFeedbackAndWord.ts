import { loadWordLists } from "@/data/words";
import type { GuessResult } from "@/types/game";
import { isGuessCompatible, checkGuess } from "..";

export async function getShapeShifterFeedbackAndWordSub(
   guess: string,
   currentTargetWord: string,
   pastGuesses: GuessResult[][],
   wordLength: number,
   hintRecord?: { letter: string; index: number } | null,
): Promise<{ nextWord: string; feedback: GuessResult[] }> {
   const { official } = await loadWordLists(wordLength);
   const upperCurrent = currentTargetWord.toUpperCase();
   const upperGuess = guess.toUpperCase();

   // Filter candidates based on past guesses AND hintRecord
   let candidates = official.map((w) => w.toUpperCase());
   for (const pastGuess of pastGuesses) {
      candidates = candidates.filter((w) => isGuessCompatible(w, pastGuess));
   }

   // If a hint was used, only keep candidates that match the hint
   if (hintRecord && hintRecord.letter) {
      const hintLetter = hintRecord.letter.toUpperCase();
      candidates = candidates.filter((w) => w[hintRecord.index] === hintLetter);
   }

   // Ensure the current target word is at least in the pool if it satisfies constraints
   if (upperCurrent && !candidates.includes(upperCurrent)) {
      const isCurrentCompatible =
         pastGuesses.every((g) => isGuessCompatible(upperCurrent, g)) &&
         (!hintRecord ||
            upperCurrent[hintRecord.index] === hintRecord.letter.toUpperCase());

      if (isCurrentCompatible) {
         candidates.push(upperCurrent);
      }
   }

   // Fallback if candidates pool is empty
   if (candidates.length === 0) {
      const fb = checkGuess(upperGuess, upperCurrent || "REACT");
      return { nextWord: upperCurrent || "REACT", feedback: fb };
   }

   // Group candidates into buckets based on the feedback they produce against the new guess
   const buckets = new Map<string, string[]>();
   for (const w of candidates) {
      const feedback = checkGuess(upperGuess, w);
      const key = feedback.map((f) => f.status).join(",");
      if (!buckets.has(key)) {
         buckets.set(key, []);
      }
      buckets.get(key)!.push(w);
   }

   // Select the largest bucket. Prefer buckets that do not make the user win immediately.
   let maxBucketSize = -1;
   let bestBucketWords: string[] = [];

   for (const [key, words] of buckets.entries()) {
      const isAllCorrect = key.split(",").every((s) => s === "correct");
      if (
         words.length > maxBucketSize ||
         (words.length === maxBucketSize && !isAllCorrect)
      ) {
         maxBucketSize = words.length;
         bestBucketWords = words;
      }
   }

   // Choose the next target word from the selected bucket
   // If the current target word is in the selected bucket, keep it. Otherwise, choose one from the bucket.
   let nextWord: string;
   if (bestBucketWords.includes(upperCurrent)) {
      nextWord = upperCurrent;
   } else {
      nextWord = bestBucketWords[0];
   }

   const feedback = checkGuess(upperGuess, nextWord);
   return { nextWord, feedback };
}
