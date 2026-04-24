// import { WORDS_4, WORDS_5, WORDS_6 } from '../data/words';
import type { GameConfig, GuessResult } from '../types/game';

// export function getDailyConfig(dateOverride?: string): GameConfig {
//   const date = dateOverride || new Date().toISOString().split('T')[0];
  
//   // Deterministic seed based on date string
//   const seed = date.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
//   const lengths: (4 | 5 | 6)[] = [4, 5, 6];
//   const length = lengths[seed % 3];
  
//   const wordList = length === 4 ? WORDS_4 : length === 5 ? WORDS_5 : WORDS_6;
//   const word = wordList[seed % wordList.length].toUpperCase();

//   return {
//     word,
//     length,
//     maxAttempts: length + 1, // 4->5, 5->6, 6->7
//   };
// }

import { WORDS_5 } from '../data/words';

// lib/gameLogic.ts

/**
 * Mulberry32 PRNG
 * Ensures that even small date changes produce a massive "jump" in the word index.
 */
const mulberry32 = (seed: number) => {
  return function() {
    let t = seed += 0x6D2B79F5;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
};

export function getDailyConfig(dateOverride?: string): GameConfig {
  const date = dateOverride || new Date().toISOString().split('T')[0];
  
  // 1. Create a high-entropy numeric seed
  // We use the date + a salt to ensure the sequence is unique to your game
  const salt = "GFARMS_V1"; 
  const numericSeed = (date + salt).split('').reduce((acc, char, i) => {
    return acc + (char.charCodeAt(0) * (i + 1));
  }, 0);

  // 2. Initialize generator
  const random = mulberry32(numericSeed);

  // 3. Constant 5-letter length
  const length = 5;
  
  // 4. Select from your Official WORDS_5 list
  // Note: Ensure WORDS_5 is imported from your data/words.ts
  const list = WORDS_5;
  
  // Using random() ensures today's word has no relation to tomorrow's alphabetically
  const wordIndex = Math.floor(random() * list.length);
  const word = list[wordIndex].toUpperCase();

  return {
    word,
    length,
    maxAttempts: 6, // Standard Wordle
  };
}

export function checkGuess(guess: string, answer: string): GuessResult[] {
  const result: GuessResult[] = Array(answer.length).fill(null).map(() => ({ letter: '', status: 'absent' }));
  const answerArray = answer.split('');
  const guessArray = guess.split('');

  // First pass: Find Corrects
  guessArray.forEach((char, i) => {
    if (char === answerArray[i]) {
      result[i] = { letter: char, status: 'correct' };
      answerArray[i] = ''; // Mark as used
    }
  });

  // Second pass: Find Presents
  guessArray.forEach((char, i) => {
    if (result[i].status !== 'correct' && answerArray.includes(char)) {
      result[i] = { letter: char, status: 'present' };
      answerArray[answerArray.indexOf(char)] = ''; // Mark as used
    } else if (result[i].status !== 'correct') {
      result[i] = { letter: char, status: 'absent' };
    }
  });

  return result;
}