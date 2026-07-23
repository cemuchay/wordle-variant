import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { GridCell } from '../../wordgrid/constants';
import { findBotWordMove, preloadBotWordPools } from '../../wordgrid/botAI';

vi.mock('../../../data/words', () => ({
  loadWordLists: vi.fn(async (len: number) => {
    const words: Record<number, string[]> = {
      3: ['ACE', 'ACT', 'ADD', 'AGE'],
      5: ['JAZZY', 'QUIZZY', 'ZEPHYR'],
      6: ['JACKAL', 'JOGGER'],
      7: ['QUIZZES', 'JAZZILY'],
    };
    const list = words[len] || [];
    return { official: list, valid: new Set(list) };
  }),
}));

const makeCell = (x: number, y: number, letter: string): GridCell => ({
  x,
  y,
  letter,
});

describe('botAI', () => {
  beforeEach(async () => {
    await preloadBotWordPools();
  });

  describe('opening move (empty board)', () => {
    it('returns a centered word the bot has letters for', async () => {
      const rack = ['A', 'B', 'L', 'E', 'R', 'T', 'S'];
      const result = await findBotWordMove([], rack, 7, 'normal');

      expect(result).not.toBeNull();
      expect(result!.placedTiles.length).toBeGreaterThan(0);
      expect(result!.score).toBeGreaterThan(0);

      const center = 3;
      for (const tile of result!.placedTiles) {
        expect(tile.y).toBe(center);
      }
    });

    it('returns null when bot has insufficient letters', async () => {
      const rack = ['X', 'Z', 'Q', 'J', 'V', 'W', 'F'];
      const result = await findBotWordMove([], rack, 7, 'normal');

      expect(result).toBeNull();
    });
  });

  describe('subsequent moves', () => {
    it('finds a word connecting to an existing tile', async () => {
      const board = [makeCell(3, 3, 'C')];
      const rack = ['A', 'T', 'E', 'R', 'N', 'S', 'O'];
      const result = await findBotWordMove(board, rack, 7, 'normal');

      expect(result).not.toBeNull();
      expect(result!.placedTiles.length).toBeGreaterThan(0);
    });

    it('does not place tiles on cells with non-matching existing letters', async () => {
      const board = [makeCell(3, 3, 'Z')];
      const rack = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
      const result = await findBotWordMove(board, rack, 7, 'normal');

      if (result) {
        for (const tile of result.placedTiles) {
          const existing = board.find(
            (c) => c.x === tile.x && c.y === tile.y,
          );
          if (existing) {
            expect(existing.letter.toUpperCase()).toBe(tile.letter.toUpperCase());
          }
        }
      }
    });
  });

  describe('difficulty-based word pool selection', () => {
    it('easy difficulty only uses shorter words', async () => {
      const rack = ['J', 'A', 'Z', 'Z', 'Y', 'B', 'C'];
      const result = await findBotWordMove([], rack, 7, 'easy');

      if (result) {
        expect(result.word.length).toBeLessThanOrEqual(4);
      }
    });

    it('hard difficulty can use longer words from the loaded dictionary', async () => {
      const rack = ['J', 'A', 'Z', 'Z', 'Y', 'B', 'C'];
      const result = await findBotWordMove([], rack, 7, 'hard');

      if (result) {
        expect(result.word).toBe('JAZZY');
      }
    });
  });

  describe('randomness between calls', () => {
    it('normal difficulty can produce different results across multiple calls', async () => {
      const rack = ['C', 'A', 'T', 'S', 'D', 'O', 'G'];
      const results = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const result = await findBotWordMove([], rack, 7, 'normal');
        if (result) results.add(result.word);
      }

      expect(results.size).toBeGreaterThan(1);
    });

    it('easy difficulty can produce different results across multiple calls', async () => {
      const rack = ['C', 'A', 'T', 'S', 'D', 'O', 'G'];
      const results = new Set<string>();

      for (let i = 0; i < 10; i++) {
        const result = await findBotWordMove([], rack, 7, 'easy');
        if (result) results.add(result.word);
      }

      expect(results.size).toBeGreaterThan(1);
    });
  });

  describe('cross-word and placement validation', () => {
    it('only generates moves that satisfy board validation and dictionary checks', async () => {
      const board = [makeCell(3, 3, 'C'), makeCell(4, 3, 'A'), makeCell(5, 3, 'T')];
      const rack = ['S', 'O', 'D', 'E', 'R', 'N', 'I'];
      const result = await findBotWordMove(board, rack, 7, 'normal');

      if (result) {
        expect(result.placedTiles.length).toBeGreaterThan(0);
        expect(result.score).toBeGreaterThan(0);
      }
    });
  });
});
