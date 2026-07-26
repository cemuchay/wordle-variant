import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getDailyConfig } from '../../lib/game-logic'

vi.mock('../../data/words', () => ({
   loadWordLists: vi.fn(async () => ({
      official: ['WORDS', 'TRACE', 'LIGHT', 'HELLO', 'QUERY'],
      valid: [],
   })),
}))

vi.mock('../../data/easy-words', () => ({
   getEasyWords: vi.fn(() => []),
}))

describe('getDailyConfig', () => {
   beforeEach(() => {
      vi.clearAllMocks()
   })

   it('returns a valid config with word, length, and maxAttempts', async () => {
      const config = await getDailyConfig(true, '2026-07-28')
      expect(config).toHaveProperty('word')
      expect(config).toHaveProperty('length')
      expect(config).toHaveProperty('maxAttempts')
      expect(config.maxAttempts).toBe(6)
      expect(typeof config.word).toBe('string')
      expect(config.word).toEqual(config.word.toUpperCase())
   })

   it('returns cached result for same date', async () => {
      const a = await getDailyConfig(true, '2026-07-28')
      const b = await getDailyConfig(true, '2026-07-28')
      expect(a.word).toBe(b.word)
      expect(a.length).toBe(b.length)
   })
})
