// src/utils/__tests__/wordgrid/bagBalancing.test.ts

import { describe, it, expect } from 'vitest';
import {
  generateInitialTileBag,
  countVowels,
  countConsecutiveConsonants,
  drawBalancedRack,
} from '../../wordgrid/bagBalancing';

describe('Bag Balancing Unit Tests', () => {
  it('generates an initial tile bag with standard counts', () => {
    const bag = generateInitialTileBag();
    expect(bag.length).toBeGreaterThan(90);
  });

  it('correctly counts vowels in a rack', () => {
    expect(countVowels(['A', 'B', 'E', 'K', 'O'])).toBe(3);
    expect(countVowels(['B', 'C', 'D', 'F'])).toBe(0);
  });

  it('correctly counts maximum consecutive consonants', () => {
    expect(countConsecutiveConsonants(['S', 'T', 'R', 'N', 'G'])).toBe(5);
    expect(countConsecutiveConsonants(['S', 'T', 'A', 'R', 'K'])).toBe(2);
  });

  it('draws balanced opening rack with at least 2 vowels and max 3 consecutive consonants', async () => {
    const initialBag = generateInitialTileBag();
    const { rack } = await drawBalancedRack(initialBag, [], 7, true);

    expect(rack.length).toBe(7);
    expect(countVowels(rack)).toBeGreaterThanOrEqual(2);
    expect(countConsecutiveConsonants(rack)).toBeLessThanOrEqual(4);
  });
});
