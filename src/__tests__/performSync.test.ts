/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePersistence } from '../hooks/useGameEngine/usePersistence';

// Mock syncWithRetry to track whether the pre-sync check lets sync proceed
const syncWithRetryMock = vi.fn().mockResolvedValue({ success: true, score: 0 });
vi.mock('../lib/game-logic', () => ({
   syncWithRetry: (...args: any[]) => syncWithRetryMock(...args),
   getLetterStatuses: () => ({}),
}));

const BASE_PAYLOAD = {
   guesses: ['GUESS1', 'GUESS2', 'GUESS3'],
   status: 'playing',
   usedHint: false,
   hintRecord: null,
   config: { maxAttempts: 6, length: 5, word: 'SAMPLE' },
};

describe('performSync — pre-sync check', () => {
   beforeEach(() => {
      const mock = (globalThis as any).__mockSupabase;
      Object.keys(mock.tables).forEach(key => delete mock.tables[key]);
      syncWithRetryMock.mockClear();
   });

   function renderHookResult(userId?: string) {
      return renderHook(() => usePersistence({
         user: userId ? { id: userId } : null,
         date: '2026-07-08',
         dispatch: vi.fn(),
         config: BASE_PAYLOAD.config,
         triggerToast: vi.fn(),
      }));
   }

   it('skips sync when cloud has same guesses and same hint state', async () => {
      const mock = (globalThis as any).__mockSupabase;
      mock.setTableData('scores', [{
         user_id: 'user1',
         game_date: '2026-07-08',
         guesses: ['GUESS1', 'GUESS2', 'GUESS3'],
         hints_used: false,
         hint_record: null,
      }]);

      const { result } = renderHookResult('user1');
      const success = await result.current.performSync(BASE_PAYLOAD);

      expect(success).toBe(true);
      expect(syncWithRetryMock).not.toHaveBeenCalled();
   });

   it('proceeds with sync when cloud has same guesses but local has new hint', async () => {
      const mock = (globalThis as any).__mockSupabase;
      mock.setTableData('scores', [{
         user_id: 'user1',
         game_date: '2026-07-08',
         guesses: ['GUESS1', 'GUESS2', 'GUESS3'],
         hints_used: false,
         hint_record: null,
      }]);

      const { result } = renderHookResult('user1');
      await result.current.performSync({
         ...BASE_PAYLOAD,
         usedHint: true,
         hintRecord: { letter: 'A', index: 0, row: 2 },
      });

      expect(syncWithRetryMock).toHaveBeenCalledTimes(1);
   });

   it('skips sync when cloud has more guesses', async () => {
      const mock = (globalThis as any).__mockSupabase;
      mock.setTableData('scores', [{
         user_id: 'user1',
         game_date: '2026-07-08',
         guesses: ['A', 'B', 'C', 'D'],
         hints_used: false,
         hint_record: null,
      }]);

      const { result } = renderHookResult('user1');
      const success = await result.current.performSync(BASE_PAYLOAD);

      expect(success).toBe(true);
      expect(syncWithRetryMock).not.toHaveBeenCalled();
   });

   it('proceeds with sync when local has more guesses than cloud', async () => {
      const mock = (globalThis as any).__mockSupabase;
      mock.setTableData('scores', [{
         user_id: 'user1',
         game_date: '2026-07-08',
         guesses: ['A', 'B'],
         hints_used: false,
         hint_record: null,
      }]);

      const { result } = renderHookResult('user1');
      await result.current.performSync({
         ...BASE_PAYLOAD,
         guesses: ['A', 'B', 'C'],
      });

      expect(syncWithRetryMock).toHaveBeenCalledTimes(1);
   });

   it('returns false when no user is provided', async () => {
      const { result } = renderHookResult();
      const success = await result.current.performSync(BASE_PAYLOAD);

      expect(success).toBe(false);
   });
});
