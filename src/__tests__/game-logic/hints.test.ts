import { describe, it, expect } from 'vitest'
import { isHintDisabled, getHint } from '../../lib/game-logic'
import type { GuessResult } from '../../types/game'

const g = (letter: string, status: GuessResult['status'], index?: number): GuessResult => ({ letter, status, index })

describe('isHintDisabled', () => {
   it('returns true when 4 out of 5 letters are discovered (1 letter away from final answer)', () => {
      const guesses: GuessResult[][] = [
         [g('W', 'correct'), g('O', 'correct'), g('R', 'correct'), g('D', 'correct'), g('?', 'absent')],
      ]
      expect(isHintDisabled('WORDS', guesses)).toBe(true)
   })

   it('returns true when discoveries come from both present and correct letters across rows totaling >= length - 1', () => {
      // WORDS (5 letters): W (correct), O (present), R (present), D (present) -> 4 discoveries -> disabled
      const guesses: GuessResult[][] = [
         [g('W', 'correct'), g('O', 'present'), g('X', 'absent'), g('Y', 'absent'), g('Z', 'absent')],
         [g('A', 'absent'), g('B', 'absent'), g('R', 'present'), g('D', 'present'), g('C', 'absent')],
      ]
      expect(isHintDisabled('WORDS', guesses)).toBe(true)
   })

   it('returns false when total discoveries across rows is < length - 1', () => {
      // WORDS (5 letters): W (correct), O (present), R (present) -> 3 discoveries -> 2 away -> not disabled
      const guesses: GuessResult[][] = [
         [g('W', 'correct'), g('O', 'present'), g('X', 'absent'), g('Y', 'absent'), g('Z', 'absent')],
         [g('A', 'absent'), g('B', 'absent'), g('R', 'present'), g('M', 'absent'), g('C', 'absent')],
      ]
      expect(isHintDisabled('WORDS', guesses)).toBe(false)
   })

   it('returns false with only 1 guess made discovering 1 letter', () => {
      const guesses: GuessResult[][] = [
         [g('T', 'present'), g('X', 'absent'), g('A', 'absent'), g('C', 'absent'), g('E', 'absent')],
      ]
      expect(isHintDisabled('WORDS', guesses)).toBe(false)
   })

   describe('double letters / duplicate letters handling', () => {
      it('treats duplicate letters in target as truly unique instances for TROLL (T-R-O-L-L)', () => {
         // Target: TROLL (5 letters, 2 Ls)
         // Row 1 discovers T, R, O (3 discoveries) -> 2 away -> not disabled
         const guess1: GuessResult[][] = [
            [g('T', 'correct'), g('R', 'correct'), g('O', 'correct'), g('X', 'absent'), g('Y', 'absent')],
         ]
         expect(isHintDisabled('TROLL', guess1)).toBe(false)

         // Guess with one L (e.g. SLATE -> L is present)
         // Total discoveries: T(1), R(1), O(1), L(1) = 4 discoveries out of 5 -> 1 letter away (second L needed) -> disabled
         const guess2: GuessResult[][] = [
            [g('T', 'correct'), g('R', 'correct'), g('O', 'correct'), g('X', 'absent'), g('Y', 'absent')],
            [g('S', 'absent'), g('L', 'present'), g('A', 'absent'), g('E', 'absent'), g('P', 'absent')],
         ]
         expect(isHintDisabled('TROLL', guess2)).toBe(true)

         // If only T, R and 1 L are discovered (3 discoveries total out of 5) -> not disabled
         const guess3: GuessResult[][] = [
            [g('T', 'correct'), g('R', 'correct'), g('X', 'absent'), g('Y', 'absent'), g('Z', 'absent')],
            [g('S', 'absent'), g('L', 'present'), g('A', 'absent'), g('E', 'absent'), g('P', 'absent')],
         ]
         expect(isHintDisabled('TROLL', guess3)).toBe(false)

         // If T, R, and both Ls are discovered in a guess (e.g. T, R, L, L -> 4 discoveries) -> 1 away (O needed) -> disabled
         const guess4: GuessResult[][] = [
            [g('T', 'correct'), g('R', 'correct'), g('X', 'absent'), g('L', 'correct'), g('L', 'correct')],
         ]
         expect(isHintDisabled('TROLL', guess4)).toBe(true)
      })

      it('does not overcount duplicates beyond the target count (e.g., guessing 3 Ls for TROLL)', () => {
         // Target: TROLL (2 Ls). Guessing L, L, L only counts as 2 discoveries of L
         const guesses: GuessResult[][] = [
            [g('L', 'present'), g('L', 'present'), g('L', 'absent'), g('X', 'absent'), g('Y', 'absent')],
         ]
         // Total discoveries: 2 Ls = 2 discoveries out of 5 -> 3 away -> not disabled
         expect(isHintDisabled('TROLL', guesses)).toBe(false)
      })
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
         [g('W', 'correct'), g('O', 'present'), g('X', 'absent'), g('Y', 'absent'), g('Z', 'absent')],
      ]
      const hint = getHint('WORDS', guesses)
      expect(hint).not.toBeNull()
      // W is correct (index 0), O is discovered (present). Undiscovered are R (2), D (3), S (4).
      expect(['R', 'D', 'S']).toContain(hint!.letter)
      expect([2, 3, 4]).toContain(hint!.index)
   })

   it('returns hint for unrevealed duplicate letter in words like TROLL', () => {
      // T, R placed; L not yet discovered
      const guesses: GuessResult[][] = [
         [g('T', 'correct'), g('R', 'correct'), g('X', 'absent'), g('Y', 'absent'), g('Z', 'absent')],
      ]
      const hint = getHint('TROLL', guesses)
      expect(hint).not.toBeNull()
      expect(['O', 'L']).toContain(hint!.letter)
      expect([2, 3, 4]).toContain(hint!.index)
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
