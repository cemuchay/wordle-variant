import { describe, it, expect } from 'vitest'
import { isHintDisabled, getHint } from '../../lib/game-logic'
import type { GuessResult } from '../../types/game'

const g = (letter: string, status: GuessResult['status'], index?: number): GuessResult => ({ letter, status, index })

describe('isHintDisabled', () => {
   it('returns true when only 1 letter remains', () => {
      const guesses: GuessResult[][] = [
         [g('W', 'correct'), g('O', 'correct'), g('R', 'correct'), g('D', 'correct'), g('?', 'absent')],
      ]
      expect(isHintDisabled('WORDS', guesses)).toBe(true)
   })

   it('returns true when 2 remaining and only 1 undiscovered', () => {
      const guesses: GuessResult[][] = [
         [g('W', 'correct'), g('O', 'correct'), g('R', 'correct'), g('D', 'correct'), g('?', 'absent')],
      ]
      expect(isHintDisabled('WORDS', guesses)).toBe(true)
   })

   it('returns false when > 1 remaining', () => {
      const guesses: GuessResult[][] = [
         [g('W', 'correct'), g('O', 'absent'), g('R', 'absent'), g('?', 'absent'), g('?', 'absent')],
      ]
      expect(isHintDisabled('WORDS', guesses)).toBe(false)
   })

   it('returns false with only 1 guess made', () => {
      const guesses: GuessResult[][] = [
         [g('T', 'present'), g('R', 'absent'), g('A', 'absent'), g('C', 'absent'), g('E', 'absent')],
      ]
      expect(isHintDisabled('WORDS', guesses)).toBe(false)
   })
})

describe('getHint', () => {
   it('returns null when hint is disabled', () => {
      const guesses: GuessResult[][] = [
         [g('W', 'correct'), g('O', 'correct'), g('R', 'correct'), g('D', 'correct'), g('?', 'absent')],
      ]
      expect(getHint('WORDS', guesses)).toBeNull()
   })

   it('returns an unrevealed letter', () => {
      const guesses: GuessResult[][] = [
         [g('T', 'present'), g('R', 'absent'), g('A', 'absent'), g('C', 'absent'), g('E', 'absent')],
      ]
      const hint = getHint('WORDS', guesses)
      expect(hint).not.toBeNull()
      expect(hint!.letter).toMatch(/^[A-Z]$/)
      expect(hint!.index).toBeGreaterThanOrEqual(0)
   })

   it('prioritizes new letters over found ones', () => {
      const guesses: GuessResult[][] = [
         [g('W', 'correct'), g('O', 'correct'), g('R', 'present'), g('?', 'absent'), g('?', 'absent')],
      ]
      const hint = getHint('WORDS', guesses)
      expect(hint).not.toBeNull()
      expect(['D', 'S']).toContain(hint!.letter)
      expect([3, 4]).toContain(hint!.index)
   })

   it('returns hint with valid letter and index properties', () => {
      const guesses: GuessResult[][] = [
         [g('T', 'absent'), g('R', 'absent'), g('A', 'absent'), g('C', 'absent'), g('E', 'absent')],
      ]
      const hint = getHint('WORDS', guesses)
      expect(hint).toHaveProperty('letter')
      expect(hint).toHaveProperty('index')
      expect(typeof hint!.letter).toBe('string')
      expect(typeof hint!.index).toBe('number')
   })
})
