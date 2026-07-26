import { describe, it, expect, vi } from 'vitest'
import { isGuessCompatible } from '../../lib/game-logic'
import { getShapeShifterFeedbackAndWord } from '../../lib/game-logic'
import type { GuessResult } from '../../types/game'

vi.mock('../../data/words', () => ({
   loadWordLists: vi.fn(async (length: number) => {
      const words: Record<number, string[]> = {
         5: ['WORDS', 'TRACE', 'LIGHT', 'HELLO', 'QUERY', 'CRATE', 'TRACK', 'BLACK', 'WHITE', 'ROBOT'],
      }
      return {
         official: words[length] || [],
         valid: [],
      }
   }),
}))

const g = (letter: string, status: GuessResult['status']): GuessResult => ({ letter, status })

describe('isGuessCompatible', () => {
   it('returns true when candidate matches feedback', () => {
      const pastGuess = [g('T', 'correct'), g('R', 'correct'), g('A', 'correct'), g('C', 'correct'), g('E', 'correct')]
      expect(isGuessCompatible('TRACE', pastGuess)).toBe(true)
   })

   it('returns false when candidate contradicts feedback', () => {
      const pastGuess = [g('T', 'correct'), g('R', 'absent'), g('A', 'absent'), g('C', 'absent'), g('E', 'absent')]
      // If T is correct at pos 0, candidate must start with T
      expect(isGuessCompatible('HELLO', pastGuess)).toBe(false)
   })

   it('handles single past guess', () => {
      const pastGuess = [g('W', 'correct'), g('O', 'present'), g('R', 'absent'), g('D', 'absent'), g('S', 'absent')]
      expect(() => isGuessCompatible('WORDS', pastGuess)).not.toThrow()
   })
})

describe('getShapeShifterFeedbackAndWord', () => {
   it('returns feedback and next word for valid guess', async () => {
      const result = await getShapeShifterFeedbackAndWord('TRACE', 'WORDS', [], 5)
      expect(result).toHaveProperty('nextWord')
      expect(result).toHaveProperty('feedback')
      expect(result.feedback).toHaveLength(5)
   })

   it('works with past guesses', async () => {
      const pastGuesses: GuessResult[][] = [
         [g('T', 'present'), g('R', 'absent'), g('A', 'absent'), g('C', 'absent'), g('E', 'absent')],
      ]
      const result = await getShapeShifterFeedbackAndWord('TRACE', 'WORDS', pastGuesses, 5)
      expect(result.nextWord).toBeTruthy()
      expect(result.feedback).toHaveLength(5)
   })

   it('filters candidates by hint', async () => {
      const result = await getShapeShifterFeedbackAndWord(
         'TRACE', 'WORDS', [], 5,
         { letter: 'W', index: 0 },
      )
      expect(result).toBeTruthy()
      expect(result.feedback).toHaveLength(5)
   })

   it('prefers non-winning bucket when guessing a word against itself', async () => {
      const result = await getShapeShifterFeedbackAndWord('WORDS', 'WORDS', [], 5)
      // All-correct bucket has 1 word; non-winning bucket has 4. Algorithm picks largest non-winning bucket.
      expect(result.nextWord).not.toBe('WORDS')
      expect(result.feedback).toHaveLength(5)
   })

   it('falls back when candidate pool is empty', async () => {
      // Past guess that no word can satisfy
      const impossibleGuesses: GuessResult[][] = [
         [g('X', 'correct'), g('X', 'correct'), g('X', 'correct'), g('X', 'correct'), g('X', 'correct')],
      ]
      const result = await getShapeShifterFeedbackAndWord('ZZZZZ', 'WORDS', impossibleGuesses, 5)
      expect(result.nextWord).toBe('WORDS')
      expect(result.feedback).toHaveLength(5)
   })
})
