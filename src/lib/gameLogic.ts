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

export function getDailyConfig(dateOverride?: string): GameConfig {
  const date = dateOverride || new Date().toISOString().split('T')[0];
  const seed = date.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  // For now, we are optimized for 5 letters
  const length = 5;
  const list = WORDS_5;
  
  // Deterministic selection from the OFFICIAL list
  const word = list[seed % list.length];

  return {
    word,
    length,
    maxAttempts: 6,
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