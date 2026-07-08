/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach } from 'vitest';
import { syncGameState } from '../lib/game-logic';

const BASE_PAYLOAD = {
   guesses: ['GUESS1', 'GUESS2', 'GUESS3'],
   status: 'playing',
   usedHint: false,
   hintRecord: null,
   config: { maxAttempts: 6, length: 5, word: 'SAMPLE' },
};

const BASE_ROW = {
   user_id: 'user1',
   game_date: '2026-07-08',
   guesses: ['GUESS1', 'GUESS2', 'GUESS3'],
   status: 'playing',
   hints_used: false,
   hint_record: null,
   word_length: 5,
   attempts: 3,
};

describe('syncGameState — DB guard', () => {
   beforeEach(() => {
      const mock = (globalThis as any).__mockSupabase;
      Object.keys(mock.tables).forEach(key => delete mock.tables[key]);
   });

   it('aborts when server has more guesses than incoming', async () => {
      const mock = (globalThis as any).__mockSupabase;
      mock.setTableData('scores', [{
         ...BASE_ROW,
         guesses: ['A', 'B', 'C', 'D'],
      }]);

      await syncGameState('user1', '2026-07-08', {
         ...BASE_PAYLOAD,
         guesses: ['A', 'B'],
      });

      expect(mock.tables['scores'][0].guesses).toHaveLength(4);
   });

   it('aborts when same guesses and server has hint but incoming does not', async () => {
      const mock = (globalThis as any).__mockSupabase;
      mock.setTableData('scores', [{
         ...BASE_ROW,
         hints_used: true,
         hint_record: { letter: 'A', index: 0, row: 2 },
      }]);

      await syncGameState('user1', '2026-07-08', {
         ...BASE_PAYLOAD,
         usedHint: false,
         hintRecord: null,
      });

      expect(mock.tables['scores'][0].hints_used).toBe(true);
      expect(mock.tables['scores'][0].hint_record).toEqual({ letter: 'A', index: 0, row: 2 });
   });

   it('aborts when same guesses and same hint state (already synced)', async () => {
      const mock = (globalThis as any).__mockSupabase;
      mock.setTableData('scores', [{
         ...BASE_ROW,
         hints_used: false,
         hint_record: null,
      }]);

      await syncGameState('user1', '2026-07-08', BASE_PAYLOAD);

      expect(mock.tables['scores'][0].guesses).toHaveLength(3);
      expect(mock.tables['scores'][0].hints_used).toBe(false);
   });

   it('proceeds and saves hint when incoming has hint but server lacks it', async () => {
      const mock = (globalThis as any).__mockSupabase;
      mock.setTableData('scores', [{
         ...BASE_ROW,
         hints_used: false,
         hint_record: null,
      }]);

      await syncGameState('user1', '2026-07-08', {
         ...BASE_PAYLOAD,
         usedHint: true,
         hintRecord: { letter: 'A', index: 0, row: 2 },
      });

      const updated = mock.tables['scores'].at(-1);
      expect(updated.hints_used).toBe(true);
      expect(updated.hint_record).toEqual({ letter: 'A', index: 0, row: 2 });
   });

   it('proceeds when incoming has more guesses than server', async () => {
      const mock = (globalThis as any).__mockSupabase;
      mock.setTableData('scores', [{
         ...BASE_ROW,
         guesses: ['A', 'B'],
         attempts: 2,
      }]);

      await syncGameState('user1', '2026-07-08', BASE_PAYLOAD);

      const updated = mock.tables['scores'].at(-1);
      expect(updated.guesses).toHaveLength(3);
   });

   it('creates a new row when no existing score exists', async () => {
      const mock = (globalThis as any).__mockSupabase;

      await syncGameState('user1', '2026-07-08', BASE_PAYLOAD);

      const updated = mock.tables['scores'].at(-1);
      expect(updated.guesses).toEqual(BASE_PAYLOAD.guesses);
   });
});
