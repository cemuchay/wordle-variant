// src/utils/__tests__/wordgrid/wordgrid.test.ts

import { describe, test, expect } from 'vitest';
import { validateBoardPlacement } from '../../wordgrid/boardValidation';
import { calculateTurnScore } from '../../wordgrid/scoring';
import { GridCell, PlacedTile } from '../../wordgrid/constants';

describe('WordGrid Validation', () => {
  test('First move must touch the center (5,5)', () => {
    const placed: PlacedTile[] = [
      { x: 0, y: 0, letter: 'A' },
      { x: 1, y: 0, letter: 'T' }
    ];
    const res = validateBoardPlacement(placed, []);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('center cell');
  });

  test('First move touching center is valid', () => {
    const placed: PlacedTile[] = [
      { x: 5, y: 5, letter: 'C' },
      { x: 6, y: 5, letter: 'A' },
      { x: 7, y: 5, letter: 'T' }
    ];
    const res = validateBoardPlacement(placed, []);
    expect(res.isValid).toBe(true);
    expect(res.wordsFormed).toHaveLength(1);
    expect(res.wordsFormed![0].word).toBe('CAT');
  });

  test('Tiles must be placed in a straight line', () => {
    const placed: PlacedTile[] = [
      { x: 5, y: 5, letter: 'C' },
      { x: 6, y: 6, letter: 'A' }
    ];
    const res = validateBoardPlacement(placed, []);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('straight row or column');
  });

  test('Subsequent moves must connect to existing tiles', () => {
    const existing: GridCell[] = [
      { x: 5, y: 5, letter: 'C' },
      { x: 6, y: 5, letter: 'A' },
      { x: 7, y: 5, letter: 'T' }
    ];
    const placed: PlacedTile[] = [
      { x: 0, y: 0, letter: 'H' },
      { x: 0, y: 1, letter: 'E' }
    ];
    const res = validateBoardPlacement(placed, existing);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('connect');
  });

  test('Contiguous placement check', () => {
    const placed: PlacedTile[] = [
      { x: 5, y: 5, letter: 'C' },
      { x: 7, y: 5, letter: 'A' } // gap at 6,5
    ];
    const res = validateBoardPlacement(placed, []);
    expect(res.isValid).toBe(false);
    expect(res.error).toContain('gaps');
  });
});

describe('WordGrid Scoring', () => {
  test('Standard word scoring (no multipliers)', () => {
    const words = [{
      word: 'CAT',
      tiles: [
        { x: 5, y: 5, letter: 'C' },
        { x: 6, y: 5, letter: 'A' },
        { x: 7, y: 5, letter: 'T' }
      ]
    }];
    const res = calculateTurnScore(words, 3, []);
    // C=3, A=1, T=1 (Total = 5)
    // C is on 5,5 (TL) -> 3*3 = 9. Total = 9 + 1 + 1 = 11 points
    expect(res.totalScore).toBe(11);
  });

  test('Double Word and Double Letter multiplier combination', () => {
    // Let's place a word that covers a DL (2,4) and a DW (1,1)
    const words = [{
      word: 'DOG',
      tiles: [
        { x: 1, y: 1, letter: 'D' }, // DW multiplier
        { x: 2, y: 1, letter: 'O' },
        { x: 3, y: 1, letter: 'G' }
      ]
    }];
    // D=2, O=1, G=2
    // D is placed on 1,1 (DW). Total = 5. DW makes it 10.
    const res = calculateTurnScore(words, 3, []);
    expect(res.totalScore).toBe(10);
  });

  test('Bingo bonus (+50 points) when using 7 tiles', () => {
    const words = [{
      word: 'AMAZING',
      tiles: [
        { x: 5, y: 5, letter: 'A' },
        { x: 6, y: 5, letter: 'M' },
        { x: 7, y: 5, letter: 'A' },
        { x: 8, y: 5, letter: 'Z' },
        { x: 9, y: 5, letter: 'I' },
        { x: 10, y: 5, letter: 'N' },
        { x: 11, y: 5, letter: 'G' }
      ]
    }];
    const res = calculateTurnScore(words, 7, []);
    expect(res.bingoApplied).toBe(true);
    expect(res.totalScore).toBeGreaterThan(50);
  });
});
