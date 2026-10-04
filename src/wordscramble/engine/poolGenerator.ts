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
 * Creates and scatters tiles from a list of base words + bonus helper tiles (vowels/common consonants)
 */
export function generateTilesFromWords(
  words: string[],
  startIdOffset: number = 0,
  rng: () => number = Math.random
): ScrambleTile[] {
  const letterPool: { letter: string; isBonus?: boolean }[] = [];

  words.forEach((w) => {
    w.toUpperCase().split('').forEach((l) => {
      letterPool.push({ letter: l, isBonus: false });
    });
  });

  // Add bonus helper tiles (butter tiles): popular vowels (A, E, I, O) & consonants (R, S, T, N, L)
  const BUTTER_TILES = ['E', 'A', 'I', 'O', 'R', 'S', 'T', 'L', 'N'];
  const bonusCount = Math.min(3, Math.max(1, Math.floor(words.length / 2)));
  for (let i = 0; i < bonusCount; i++) {
    const randomBonusLetter = BUTTER_TILES[Math.floor(rng() * BUTTER_TILES.length)];
    letterPool.push({ letter: randomBonusLetter, isBonus: true });
  }

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
 * Applies +50% bonus if the submitted word matches one of the secret original spool words
 */
export function calculateWordScore(
  word: string,
  streak: number = 1,
  isSpoolBonus: boolean = false
): number {
  const upper = word.toUpperCase();
  let baseLetterPoints = 0;
  for (const char of upper) {
    baseLetterPoints += SCRABBLE_LETTER_VALUES[char] || 1;
  }

  // Length multiplier
  const lengthMultiplier = upper.length >= 7 ? 2.5 : upper.length >= 5 ? 1.8 : 1.2;
  const streakBonus = Math.min(streak * 0.15, 1.0); // up to +100% bonus for streak
  const spoolMultiplier = isSpoolBonus ? 1.5 : 1.0; // +50% bonus for original secret spool word

  return Math.round(baseLetterPoints * 10 * lengthMultiplier * (1 + streakBonus) * spoolMultiplier);
}

/**
 * Calculate dynamic time bonus in seconds for a correctly submitted word in timed mode.
 * Higher score value, longer words, and quick submissions award higher time bonuses (+2s to +8s).
 */
export function calculateTimeBonus(
  wordLength: number,
  score: number,
  secondsSinceLastWord: number = 5,
  isSpoolBonus: boolean = false
): number {
  // Base bonus by length: 3L = 2s, 4L = 3s, 5L = 4s, 6L = 5s, 7L+ = 6s
  let bonus = Math.min(6, Math.max(2, wordLength - 1));

  // Score magnitude bonus
  if (score >= 400) bonus += 2;
  else if (score >= 200) bonus += 1;

  // Speed bonus: submitted within 3 seconds of last word/game start
  if (secondsSinceLastWord <= 3) {
    bonus += 1;
  }

  // Original spool bonus adds +1s extra
  if (isSpoolBonus) {
    bonus += 1;
  }

  return Math.min(10, bonus);
}

/**
 * Calculate time decay multiplier based on total words found relative to game progress.
 * After 10 words: +10% faster (1.1x)
 * After 20 words: +20% faster (1.2x)
 * After 30 words: +30% faster (1.3x)
 * After 45 words: +50% faster (1.5x)
 */
export function calculateTimeDecayMultiplier(wordsFoundCount: number): number {
  if (wordsFoundCount >= 45) return 1.5;
  if (wordsFoundCount >= 30) return 1.3;
  if (wordsFoundCount >= 20) return 1.2;
  if (wordsFoundCount >= 10) return 1.1;
  return 1.0;
}

