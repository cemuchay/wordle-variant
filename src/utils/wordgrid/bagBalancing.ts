// src/utils/wordgrid/bagBalancing.ts

import { TILE_BAG_DISTRIBUTION } from './constants';
import { validateWordInDictionary } from './dictionary';

const VOWELS = new Set(['A', 'E', 'I', 'O', 'U']);

// Helper to generate a full initial bag of tiles
export function generateInitialTileBag(): string[] {
  const bag: string[] = [];
  Object.entries(TILE_BAG_DISTRIBUTION).forEach(([letter, count]) => {
    for (let i = 0; i < count; i++) {
      bag.push(letter);
    }
  });
  // Shuffle bag using Fisher-Yates
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

// Counts vowels in a rack
export function countVowels(rack: string[]): number {
  return rack.reduce((cnt, letter) => (VOWELS.has(letter.toUpperCase()) ? cnt + 1 : cnt), 0);
}

// Checks if adding a tile violates the maximum consecutive consonant rule (max 3)
export function countConsecutiveConsonants(rack: string[]): number {
  let maxCons = 0;
  let currentCons = 0;
  for (const letter of rack) {
    if (!VOWELS.has(letter.toUpperCase()) && letter !== '_') {
      currentCons++;
      if (currentCons > maxCons) maxCons = currentCons;
    } else {
      currentCons = 0;
    }
  }
  return maxCons;
}

// Check if at least 1 valid word of length >= 2 can be formed from a rack
export async function hasPlayableWord(rack: string[]): Promise<boolean> {
  const letters = rack.map((l) => l.toUpperCase());
  
  // Try combinations of length 2 to 5 to check playability fast
  const getPermutations = (arr: string[], minLen = 2, maxLen = 4): string[] => {
    const results = new Set<string>();

    const search = (current: string, remaining: string[]) => {
      if (current.length >= minLen) {
        results.add(current);
      }
      if (current.length >= maxLen) return;

      for (let i = 0; i < remaining.length; i++) {
        const nextLetter = remaining[i];
        if (nextLetter === '_') {
          // Try standard vowels for blank tile check
          ['A', 'E', 'I', 'O', 'U', 'S', 'T'].forEach((v) => {
            search(current + v, [...remaining.slice(0, i), ...remaining.slice(i + 1)]);
          });
        } else {
          search(current + nextLetter, [...remaining.slice(0, i), ...remaining.slice(i + 1)]);
        }
      }
    };

    search('', arr);
    return Array.from(results);
  };

  const candidates = getPermutations(letters, 2, 4);

  // Check top 25 candidate combinations against dictionary
  const sample = candidates.slice(0, 25);
  for (const word of sample) {
    const isValid = await validateWordInDictionary(word);
    if (isValid) return true;
  }

  // Fallback default: if rack has vowels and common consonants, treat as playable
  return countVowels(letters) >= 2;
}

// Intelligent balanced tile draw
export async function drawBalancedRack(
  bag: string[],
  currentRack: string[] = [],
  targetSize = 7,
  isOpeningRack = false
): Promise<{ rack: string[]; newBag: string[] }> {
  const newBag = [...bag];
  const rack = [...currentRack];
  let attempts = 0;

  while (rack.length < targetSize && newBag.length > 0 && attempts < 100) {
    attempts++;
    const candidateIdx = newBag.length - 1;
    const candidateLetter = newBag[candidateIdx];

    // Check vowel rule for initial draws (aim for at least 2 vowels if rack size is 7)
    const currentVowels = countVowels(rack);
    const tilesNeeded = targetSize - rack.length;
    const isVowel = VOWELS.has(candidateLetter.toUpperCase());

    if (isOpeningRack && currentVowels < 2 && tilesNeeded <= 2 - currentVowels && !isVowel) {
      // Find a vowel in the bag to swap to top
      const vowelIdx = newBag.findIndex((l) => VOWELS.has(l.toUpperCase()));
      if (vowelIdx !== -1) {
        [newBag[candidateIdx], newBag[vowelIdx]] = [newBag[vowelIdx], newBag[candidateIdx]];
      }
    }

    // Check consecutive consonants rule (max 3 in a row)
    const testRack = [...rack, newBag[candidateIdx]];
    if (countConsecutiveConsonants(testRack) > 3) {
      // Find a vowel or blank in bag to substitute
      const substituteIdx = newBag.findIndex(
        (l) => VOWELS.has(l.toUpperCase()) || l === '_'
      );
      if (substituteIdx !== -1) {
        [newBag[candidateIdx], newBag[substituteIdx]] = [newBag[substituteIdx], newBag[candidateIdx]];
      }
    }

    // Pull tile from bag to rack
    rack.push(newBag.pop()!);
  }

  // If opening rack, ensure playable word exists
  if (isOpeningRack && rack.length === targetSize) {
    let playable = await hasPlayableWord(rack);
    let swapCount = 0;
    while (!playable && swapCount < 5 && newBag.length >= 3) {
      // Return 2 tiles to bag, shuffle, and redraw
      newBag.push(rack.pop()!, rack.pop()!);
      for (let i = newBag.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newBag[i], newBag[j]] = [newBag[j], newBag[i]];
      }
      while (rack.length < targetSize && newBag.length > 0) {
        rack.push(newBag.pop()!);
      }
      playable = await hasPlayableWord(rack);
      swapCount++;
    }
  }

  return { rack, newBag };
}
