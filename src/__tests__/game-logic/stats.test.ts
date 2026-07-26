import { describe, it, expect, vi, beforeEach } from 'vitest'
import { updateStats } from '../../lib/game-logic'

const mockStorage: Record<string, string> = {}

vi.mock('../../utils/storage', () => ({
   safeLocalStorage: {
      getItem: vi.fn((key: string) => mockStorage[key] ?? null),
      setItem: vi.fn((key: string, value: string) => {
         mockStorage[key] = value
      }),
   },
}))

beforeEach(() => {
   Object.keys(mockStorage).forEach(k => delete mockStorage[k])
   vi.clearAllMocks()
})

describe('updateStats', () => {
   it('returns initial stats on first win', () => {
      const result = updateStats(true, 3)
      expect(result.gamesPlayed).toBe(1)
      expect(result.gamesWon).toBe(1)
      expect(result.currentStreak).toBe(1)
      expect(result.maxStreak).toBe(1)
      expect(result.guesses['3']).toBe(1)
   })

   it('increments streak on consecutive wins', () => {
      updateStats(true, 3)
      const result = updateStats(true, 4)
      expect(result.gamesPlayed).toBe(2)
      expect(result.gamesWon).toBe(2)
      expect(result.currentStreak).toBe(2)
      expect(result.maxStreak).toBe(2)
   })

   it('resets streak on loss and increments X', () => {
      updateStats(true, 3)
      const result = updateStats(false, 6)
      expect(result.gamesPlayed).toBe(2)
      expect(result.gamesWon).toBe(1)
      expect(result.currentStreak).toBe(0)
      expect(result.maxStreak).toBe(1)
      expect(result.guesses['X']).toBe(1)
   })

   it('correctly tracks guess distribution', () => {
      updateStats(true, 1)
      updateStats(true, 2)
      updateStats(true, 3)
      const result = updateStats(true, 4)
      expect(result.guesses['1']).toBe(1)
      expect(result.guesses['2']).toBe(1)
      expect(result.guesses['3']).toBe(1)
      expect(result.guesses['4']).toBe(1)
   })

   it('handles multiple losses', () => {
      updateStats(false, 6)
      const result = updateStats(false, 6)
      expect(result.guesses['X']).toBe(2)
      expect(result.currentStreak).toBe(0)
   })
})
