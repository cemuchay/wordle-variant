// import { WORDS_4, WORDS_5, WORDS_6 } from '../data/words';
import type { GameConfig, GuessResult } from "../types/game";

import { getWordLists } from "../data/words";

// lib/gameLogic.ts

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

export function getDailyConfig(dateOverride?: string): GameConfig {
   const date = dateOverride || new Date().toISOString().split("T")[0];
   const salt = "GFARMS_BETA_V2";
   const numericSeed = (date + salt)
      .split("")
      .reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);
   const random = mulberry32(numericSeed);

   // 1. Determine length (4, 5, or 6)
   const lengthChoices = [4, 5, 6] as const;
   const length = lengthChoices[Math.floor(random() * 3)];

   // 2. Get correct lists
   const { official } = getWordLists(length);

   // 3. Pick the word
   const word = official[Math.floor(random() * official.length)].toUpperCase();

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
