import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getWordAtDate, getRandomWord } from '../../lib/game-logic'
import { getISOWeekInfo, getWeeklyLengthSchedule, getSeededWeeklyWordLength } from '../../lib/game-logic/helpers/getWordAtDate'

vi.mock('../../data/words', () => ({
   loadWordLists: vi.fn(async (length: number) => {
      const words: Record<number, string[]> = {
         4: ['ONCE', 'TWIN', 'FOUR', 'FIVE', 'SIXT'],
         5: ['WORDS', 'TRACE', 'LIGHT', 'HELLO', 'QUERY'],
         6: ['RANDOM', 'LETTER', 'SYSTEM', 'WINDOW', 'BRIDGE'],
         7: ['WELCOME', 'PROJECT', 'VERSION', 'BETWEEN', 'CONTROL'],
      }
      return {
         official: words[length] || [],
         valid: [],
      }
   }),
}))

vi.mock('../../data/easy-words', () => ({
   getEasyWords: vi.fn((length: number) => {
      const words: Record<number, string[]> = {
         4: ['ONCE', 'TWIN'],
         5: ['HELLO', 'WORLD'],
      }
      return words[length] || []
   }),
}))

describe('getWordAtDate — July 27+ rotation', () => {
   beforeEach(() => {
      vi.clearAllMocks()
   })

   it('returns a word for a post-rotation date', async () => {
      const word = await getWordAtDate('2026-07-28', true, 0)
      expect(word).toBeTruthy()
      expect(typeof word).toBe('string')
      expect(word).toEqual(word.toUpperCase())
   })

   it('returns different words for auth vs guest', async () => {
      const auth = await getWordAtDate('2026-07-28', true, 0)
      const guest = await getWordAtDate('2026-07-28', false, 0)
      expect(auth).not.toBe(guest)
   })

   it('retry returns a valid word', async () => {
      const word = await getWordAtDate('2026-07-28', true, 1)
      expect(word).toBeTruthy()
      expect(typeof word).toBe('string')
      expect(word).toEqual(word.toUpperCase())
   })
})

describe('getRandomWord', () => {
   beforeEach(() => {
      vi.clearAllMocks()
   })

   it('returns word of requested length', async () => {
      const word = await getRandomWord(5)
      expect(word).toHaveLength(5)
      expect(word).toEqual(word.toUpperCase())
   })

   it('returns easy word with easy difficulty', async () => {
      const word = await getRandomWord(5, 'easy')
      expect(word).toHaveLength(5)
   })

   it('returns normal word by default', async () => {
      const word = await getRandomWord(5)
      expect(word).toHaveLength(5)
   })
})

describe('getISOWeekInfo', () => {
   it('returns correct week info for a Monday', () => {
      const info = getISOWeekInfo('2026-07-27')
      expect(info.dayIndex).toBe(0)
      expect(info.weekNumber).toBe(31)
   })

   it('returns correct week info for a Sunday', () => {
      const info = getISOWeekInfo('2026-08-02')
      expect(info.dayIndex).toBe(6)
   })

   it('returns correct year for a new year week', () => {
      const info = getISOWeekInfo('2027-01-04')
      expect(info.year).toBe(2027)
   })
})

describe('getWeeklyLengthSchedule', () => {
   it('contains all 7 lengths [4,4,5,5,6,6,7]', () => {
      const schedule = getWeeklyLengthSchedule(2026, 31)
      expect(schedule).toHaveLength(7)
      expect(schedule.sort()).toEqual([4, 4, 5, 5, 6, 6, 7])
   })

   it('is deterministic for same week', () => {
      const a = getWeeklyLengthSchedule(2026, 31)
      const b = getWeeklyLengthSchedule(2026, 31)
      expect(a).toEqual(b)
   })

   it('produces different order for different weeks', () => {
      const a = getWeeklyLengthSchedule(2026, 31)
      const b = getWeeklyLengthSchedule(2026, 32)
      expect(a).not.toEqual(b)
   })

   it('has no adjacent same lengths', () => {
      const schedule = getWeeklyLengthSchedule(2026, 31)
      for (let i = 0; i < schedule.length - 1; i++) {
         expect(schedule[i]).not.toBe(schedule[i + 1])
      }
   })
})

describe('getSeededWeeklyWordLength', () => {
   it('returns a valid length value', () => {
      const length = getSeededWeeklyWordLength('2026-07-27')
      expect([4, 5, 6, 7]).toContain(length)
   })

   it('covers all 7 lengths across a full week', () => {
      const start = new Date(Date.UTC(2026, 6, 27)) // July 27, 2026
      const seen = new Set<number>()
      for (let i = 0; i < 7; i++) {
         const d = new Date(start)
         d.setUTCDate(d.getUTCDate() + i)
         const dateStr = d.toISOString().split('T')[0]
         seen.add(getSeededWeeklyWordLength(dateStr))
      }
      expect(seen.size).toBe(4)
      expect(seen).toEqual(new Set([4, 5, 6, 7]))
   })
})
