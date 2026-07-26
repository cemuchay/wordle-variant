import { describe, it, expect } from 'vitest'
import { getLetterStatuses, checkGuess } from '../../lib/game-logic'
import type { GuessResult } from '../../types/game'

const g = (letter: string, status: GuessResult['status']): GuessResult => ({ letter, status })

describe('checkGuess', () => {
   it('all correct on exact match', () => {
      const result = checkGuess('TRACE', 'TRACE')
      expect(result).toHaveLength(5)
      result.forEach(r => expect(r.status).toBe('correct'))
      expect(result.map(r => r.letter).join('')).toBe('TRACE')
   })

   it('all absent on no match', () => {
      const result = checkGuess('XXXXX', 'TRACE')
      result.forEach(r => expect(r.status).toBe('absent'))
   })

   it('detects present letters', () => {
      const result = checkGuess('CRATE', 'TRACE')
      const present = result.filter(r => r.status === 'present')
      expect(present.length).toBeGreaterThanOrEqual(2)
      const correct = result.filter(r => r.status === 'correct')
      expect(correct.length).toBeGreaterThanOrEqual(1)
   })

   it('handles duplicate — guess has 2, answer has 0', () => {
      const result = checkGuess('PEPPY', 'AUDIO')
      result.forEach(r => {
         if (r.letter === 'P') expect(r.status).toBe('absent')
      })
   })

   it('handles duplicate — all correct', () => {
      const result = checkGuess('PEPPY', 'PEPPY')
      result.forEach(r => expect(r.status).toBe('correct'))
   })

   it('handles duplicate — one correct, one present', () => {
      const result = checkGuess('PEPPY', 'PEPER')
      expect(result[0].status).toBe('correct')
      expect(result[2].status).toBe('correct')
   })

   it('handles duplicate — guess has 3, answer has 1', () => {
      const result = checkGuess('AAABS', 'ABCDE')
      expect(result[0].status).toBe('correct')
      expect(result[1].status).toBe('absent')
      expect(result[2].status).toBe('absent')
   })

   it('is case sensitive (caller normalizes before calling)', () => {
      const result = checkGuess('trace', 'TRACE')
      expect(result[0].status).toBe('absent')
   })

   it('handles shorter guess', () => {
      const result = checkGuess('ABC', 'ABCDE')
      expect(result).toHaveLength(5)
   })
})

describe('getLetterStatuses', () => {
   it('aggregates with correct > present > absent priority', () => {
      const guesses: GuessResult[][] = [
         [g('A', 'absent'), g('B', 'present'), g('C', 'correct')],
      ]
      const statuses = getLetterStatuses(guesses)
      expect(statuses['A']).toBe('absent')
      expect(statuses['B']).toBe('present')
      expect(statuses['C']).toBe('correct')
   })

   it('correct overrides present', () => {
      const guesses: GuessResult[][] = [
         [g('A', 'present'), g('A', 'correct')],
      ]
      const statuses = getLetterStatuses(guesses)
      expect(statuses['A']).toBe('correct')
   })

   it('correct overrides absent', () => {
      const guesses: GuessResult[][] = [
         [g('A', 'absent'), g('A', 'correct')],
      ]
      const statuses = getLetterStatuses(guesses)
      expect(statuses['A']).toBe('correct')
   })

   it('present overrides absent', () => {
      const guesses: GuessResult[][] = [
         [g('A', 'absent'), g('A', 'present')],
      ]
      const statuses = getLetterStatuses(guesses)
      expect(statuses['A']).toBe('present')
   })

   it('returns empty for empty input', () => {
      expect(getLetterStatuses([])).toEqual({})
   })
})
