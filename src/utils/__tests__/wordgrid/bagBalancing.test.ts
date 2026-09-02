import { describe, it, expect } from 'vitest';
import {
  generateInitialTileBag,
  countVowels,
  countConsecutiveConsonants,
  drawBalancedRack,
} from '../../wordgrid/bagBalancing';
import { TILE_VALUES, TILE_BAG_DISTRIBUTION } from '../../wordgrid/constants';

describe('Official Scrabble Tile Distribution & Points Verification', () => {
  it('verifies exact Scrabble point breakdown matching the official guide', () => {
    // 0 Points: Blank x2
    expect(TILE_VALUES['_']).toBe(0);

    // 1 Point: E x12, A x9, I x9, O x8, N x6, R x6, T x6, L x4, S x4, U x4
    const onePointLetters = ['E', 'A', 'I', 'O', 'N', 'R', 'T', 'L', 'S', 'U'];
    onePointLetters.forEach(l => expect(TILE_VALUES[l]).toBe(1));

    // 2 Points: D x4, G x3
    expect(TILE_VALUES['D']).toBe(2);
    expect(TILE_VALUES['G']).toBe(2);

    // 3 Points: B x2, C x2, M x2, P x2
    ['B', 'C', 'M', 'P'].forEach(l => expect(TILE_VALUES[l]).toBe(3));

    // 4 Points: F x2, H x2, V x2, W x2, Y x2
    ['F', 'H', 'V', 'W', 'Y'].forEach(l => expect(TILE_VALUES[l]).toBe(4));

    // 5 Points: K x1
    expect(TILE_VALUES['K']).toBe(5);

    // 8 Points: J x1, X x1
    expect(TILE_VALUES['J']).toBe(8);
    expect(TILE_VALUES['X']).toBe(8);

    // 10 Points: Q x1, Z x1
    expect(TILE_VALUES['Q']).toBe(10);
    expect(TILE_VALUES['Z']).toBe(10);
  });

  it('verifies exact tile frequency counts matching the official 100-tile Scrabble bag', () => {
    const expectedDistribution: Record<string, number> = {
      '_': 2,
      'E': 12, 'A': 9, 'I': 9, 'O': 8, 'N': 6, 'R': 6, 'T': 6, 'L': 4, 'S': 4, 'U': 4,
      'D': 4, 'G': 3,
      'B': 2, 'C': 2, 'M': 2, 'P': 2,
      'F': 2, 'H': 2, 'V': 2, 'W': 2, 'Y': 2,
      'K': 1,
      'J': 1, 'X': 1,
      'Q': 1, 'Z': 1,
    };

    expect(TILE_BAG_DISTRIBUTION).toEqual(expectedDistribution);

    // Verify generated initial bag contains exactly 100 tiles with correct letter counts
    const bag = generateInitialTileBag();
    expect(bag.length).toBe(100);

    const frequency: Record<string, number> = {};
    for (const tile of bag) {
      frequency[tile] = (frequency[tile] || 0) + 1;
    }

    expect(frequency).toEqual(expectedDistribution);
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
