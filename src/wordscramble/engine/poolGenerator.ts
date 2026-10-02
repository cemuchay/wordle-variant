import type { ScrambleTile } from './types';
import { SCRABBLE_LETTER_VALUES } from './rainbowColors';

/**
 * Deterministic pseudo-random number generator for seedable games
 */
export function createRng(seedStr: string = Date.now().toString()) {
  let seed = 0;
  for (let i = 0; i < seedStr.length; i++) {
    seed = (seed << 5) - seed + seedStr.charCodeAt(i);
    seed |= 0;
  }
  let s = Math.abs(seed) || 123456789;

  return function random(): number {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Spools a set of secret valid words based on target lengths
 */
export function spoolSecretWords(
  wordListMap: Record<number, string[]>,
  selectedLengths: number[],
  wordCount: number = 6,
  rng: () => number = Math.random
): string[] {
  const chosenWords: string[] = [];
  
  for (let i = 0; i < wordCount; i++) {
    const targetLength = selectedLengths[i % selectedLengths.length];
    const available = wordListMap[targetLength] || [];
    if (available.length > 0) {
      const idx = Math.floor(rng() * available.length);
      chosenWords.push(available[idx]);
    }
  }

  return chosenWords;
}

/**
 * Creates and scatters tiles from a list of base words
 */
export function generateTilesFromWords(
  words: string[],
  startIdOffset: number = 0,
  rng: () => number = Math.random
): ScrambleTile[] {
  const letterPool: { letter: string; wordOrigin: string }[] = [];

  words.forEach((w) => {
    w.toUpperCase().split('').forEach((l) => {
      letterPool.push({ letter: l, wordOrigin: w });
    });
  });

  // Fisher-Yates shuffle
  for (let i = letterPool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [letterPool[i], letterPool[j]] = [letterPool[j], letterPool[i]];
  }

  return letterPool.map((item, idx) => ({
    id: `tile_${startIdOffset + idx}_${item.letter}_${Math.floor(rng() * 10000)}`,
    letter: item.letter,
    originalIndex: startIdOffset + idx,
    status: 'available',
    colorIndex: (startIdOffset + idx) % 8,
  }));
}

/**
 * Calculate score for a submitted word
 */
export function calculateWordScore(word: string, streak: number = 1): number {
  const upper = word.toUpperCase();
  let baseLetterPoints = 0;
  for (const char of upper) {
    baseLetterPoints += SCRABBLE_LETTER_VALUES[char] || 1;
  }

  // Length multiplier
  const lengthMultiplier = upper.length >= 7 ? 2.5 : upper.length >= 5 ? 1.8 : 1.2;
  const streakBonus = Math.min(streak * 0.15, 1.0); // up to +100% bonus for streak

  return Math.round(baseLetterPoints * 10 * lengthMultiplier * (1 + streakBonus));
}
