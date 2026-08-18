import { describe, it, expect } from 'vitest'
import { calculateSkillIndexJuly2026 } from '../../lib/game-logic/scoringJuly2026'

const g = (letter: string, status: string) => ({ letter, status })

describe('calculateSkillIndexJuly2026', () => {
   it('returns all fields in result', () => {
      const result = calculateSkillIndexJuly2026({
         attempts: 1,
         maxAttempts: 6,
         usedHint: false,
         guesses: [[g('W', 'correct'), g('O', 'correct'), g('R', 'correct'), g('D', 'correct'), g('S', 'correct')]],
      })
      expect(result).toHaveProperty('rows')
      expect(result).toHaveProperty('base')
      expect(result).toHaveProperty('bonus')
      expect(result).toHaveProperty('hint')
      expect(result).toHaveProperty('decisions')
      expect(result).toHaveProperty('finalScore')
   })

   it('returns 0 for empty guesses', () => {
      const result = calculateSkillIndexJuly2026({
         attempts: 0,
         maxAttempts: 6,
         usedHint: false,
         guesses: [],
      })
      expect(result.finalScore).toBe(0)
   })

   it('win in 1 — correct letters get max row 0 points (65 per letter)', () => {
      const result = calculateSkillIndexJuly2026({
         attempts: 1,
         maxAttempts: 6,
         usedHint: false,
         guesses: [[g('W', 'correct'), g('O', 'correct'), g('R', 'correct'), g('D', 'correct'), g('S', 'correct')]],
      })
      expect(result.rows[0]).toBe(5 * 65) // 325
      expect(result.base).toBe(1000) // (6 - 1 + 1) / 6 * 1000 = 1000
      expect(result.finalScore).toBe(1000 + 325)
   })

   it('win in 2 — row 1 correct gets 55 per letter', () => {
      const guesses = [
         [g('T', 'absent'), g('R', 'present'), g('A', 'present'), g('C', 'present'), g('E', 'present')],
         [g('T', 'correct'), g('R', 'correct'), g('A', 'correct'), g('C', 'correct'), g('E', 'correct')],
      ]
      const result = calculateSkillIndexJuly2026({
         attempts: 2,
         maxAttempts: 6,
         usedHint: false,
         guesses,
      })
      expect(result.base).toBe(833) // floor((6 - 2 + 1) / 6 * 1000) = 833
      expect(result.finalScore).toBeGreaterThan(0)
   })

   it('absent penalty applied for new absent letters in row 0', () => {
      const guesses = [
         [g('X', 'absent'), g('Y', 'absent'), g('Z', 'absent'), g('A', 'correct'), g('B', 'correct')],
         [g('W', 'correct'), g('O', 'correct'), g('R', 'correct'), g('D', 'correct'), g('S', 'correct')],
      ]
      const result = calculateSkillIndexJuly2026({
         attempts: 2,
         maxAttempts: 6,
         usedHint: false,
         guesses,
      })
      // Row 0: 2 correct letters (2 * 65 = 130) + 3 absent (-3 * 5 = -15) = 115
      expect(result.rows[0]).toBe(115)
   })

   it('repeated absent penalty in later rows', () => {
      const guesses = [
         [g('X', 'absent'), g('W', 'correct'), g('O', 'correct'), g('R', 'correct'), g('D', 'correct')],
         [g('X', 'absent'), g('O', 'correct'), g('R', 'correct'), g('D', 'correct'), g('S', 'correct')],
      ]
      const result = calculateSkillIndexJuly2026({
         attempts: 2,
         maxAttempts: 6,
         usedHint: false,
         guesses,
      })
      // Row 1: X is repeated absent → -20 penalty
      expect(result.rows[1]).toBeLessThan(result.rows[0])
   })

   it('hint penalty applied when hintRecord has a row', () => {
      const guesses = [
         [g('T', 'present'), g('R', 'absent'), g('A', 'absent'), g('C', 'absent'), g('E', 'absent')],
         [g('W', 'correct'), g('O', 'correct'), g('R', 'correct'), g('D', 'correct'), g('S', 'correct')],
      ]
      const result = calculateSkillIndexJuly2026({
         attempts: 2,
         maxAttempts: 6,
         usedHint: true,
         guesses,
         hintRecord: { letter: 'W', index: 0, row: 1 },
      })
      expect(result.hint).toBe(-100)
   })

   it('green→yellow regression deducted', () => {
      const guesses = [
         [g('W', 'correct'), g('O', 'absent'), g('R', 'absent'), g('D', 'absent'), g('S', 'absent')],
         [g('W', 'present'), g('O', 'correct'), g('R', 'correct'), g('D', 'correct'), g('S', 'correct')],
      ]
      const result = calculateSkillIndexJuly2026({
         attempts: 2,
         maxAttempts: 6,
         usedHint: false,
         guesses,
      })
      // expect regression deductions exist in decisions
      const regressionDecisions = result.decisions[1]?.decisions.filter(
         d => d.status.includes('regression'),
      )
      expect(regressionDecisions?.length).toBeGreaterThanOrEqual(1)
   })

   it('green→black regression deducted', () => {
      const guesses = [
         [g('W', 'correct'), g('O', 'correct'), g('R', 'absent'), g('D', 'absent'), g('S', 'absent')],
         [g('W', 'absent'), g('O', 'correct'), g('R', 'correct'), g('D', 'correct'), g('S', 'correct')],
      ]
      const result = calculateSkillIndexJuly2026({
         attempts: 2,
         maxAttempts: 6,
         usedHint: false,
         guesses,
      })
      const regressionDecisions = result.decisions[1]?.decisions.filter(
         d => d.status.includes('regression'),
      )
      expect(regressionDecisions?.length).toBeGreaterThanOrEqual(1)
   })

   it('loss results in base score of 0', () => {
      const guesses = [
         [g('X', 'absent'), g('Y', 'absent'), g('Z', 'absent'), g('A', 'absent'), g('B', 'absent')],
         [g('C', 'absent'), g('D', 'absent'), g('E', 'absent'), g('F', 'absent'), g('G', 'absent')],
      ]
      const result = calculateSkillIndexJuly2026({
         attempts: 6,
         maxAttempts: 6,
         usedHint: false,
         guesses,
      })
      expect(result.base).toBe(0)
   })

   it('no double-counting: same letter across rows', () => {
      const guesses = [
         [g('W', 'present'), g('O', 'absent'), g('R', 'absent'), g('D', 'absent'), g('S', 'absent')],
         [g('W', 'present'), g('O', 'absent'), g('R', 'absent'), g('D', 'absent'), g('S', 'absent')],
         [g('W', 'correct'), g('O', 'correct'), g('R', 'correct'), g('D', 'correct'), g('S', 'correct')],
      ]
      const result = calculateSkillIndexJuly2026({
         attempts: 3,
         maxAttempts: 6,
         usedHint: false,
         guesses,
      })
      // Points for W should only be awarded once
      const allDecisions = result.decisions.flatMap(d => d.decisions)
      const wAwards = allDecisions.filter(d => d.letter === 'W' && d.pointDeduction > 0)
      expect(wAwards.length).toBe(1)
   })

   describe('nearly got it bonus (+84 points)', () => {
      it('awards +84 points when a prior guess has all greens except one letter (HILLY -> BILLY)', () => {
         // Target: BILLY (5 letters). Row 0 has 4 greens (H-I-L-L-Y), Row 1 solves it (B-I-L-L-Y)
         const guessesWithNearlyGotIt = [
            [g('H', 'absent'), g('I', 'correct'), g('L', 'correct'), g('L', 'correct'), g('Y', 'correct')],
            [g('B', 'correct'), g('I', 'correct'), g('L', 'correct'), g('L', 'correct'), g('Y', 'correct')],
         ]
         const resultWithBonus = calculateSkillIndexJuly2026({
            attempts: 2,
            maxAttempts: 6,
            usedHint: false,
            guesses: guessesWithNearlyGotIt,
         })

         // Control: guess with only 3 greens in row 0
         const guessesWithoutNearlyGotIt = [
            [g('H', 'absent'), g('A', 'absent'), g('L', 'correct'), g('L', 'correct'), g('Y', 'correct')],
            [g('B', 'correct'), g('I', 'correct'), g('L', 'correct'), g('L', 'correct'), g('Y', 'correct')],
         ]
         const resultWithoutBonus = calculateSkillIndexJuly2026({
            attempts: 2,
            maxAttempts: 6,
            usedHint: false,
            guesses: guessesWithoutNearlyGotIt,
         })

         expect(resultWithBonus.nearlyGotIt).toBe(84)
         expect(resultWithBonus.bonus).toBe(resultWithBonus.rows[0] + resultWithBonus.rows[1])
         expect(resultWithBonus.finalScore).toBe(resultWithBonus.base + resultWithBonus.rows[0] + resultWithBonus.rows[1] + 84)

         expect(resultWithoutBonus.nearlyGotIt).toBe(0)
         expect(resultWithoutBonus.bonus).toBe(resultWithoutBonus.rows[0] + resultWithoutBonus.rows[1])
      })

      it('awards +84 points for 4-letter words with 3 greens in prior row (CROW -> BROW)', () => {
         const guesses = [
            [g('C', 'absent'), g('R', 'correct'), g('O', 'correct'), g('W', 'correct')],
            [g('T', 'absent'), g('R', 'correct'), g('O', 'correct'), g('W', 'correct')],
            [g('B', 'correct'), g('R', 'correct'), g('O', 'correct'), g('W', 'correct')],
         ]
         const result = calculateSkillIndexJuly2026({
            attempts: 3,
            maxAttempts: 6,
            usedHint: false,
            guesses,
         })
         const sumRows = result.rows.reduce((a, b) => a + b, 0)
         expect(result.nearlyGotIt).toBe(84)
         expect(result.bonus).toBe(sumRows)
         expect(result.finalScore).toBe(result.base + sumRows + 84)
      })

      it('does not award bonus if game is lost', () => {
         const guesses = [
            [g('H', 'absent'), g('I', 'correct'), g('L', 'correct'), g('L', 'correct'), g('Y', 'correct')],
            [g('M', 'absent'), g('I', 'correct'), g('L', 'correct'), g('L', 'correct'), g('Y', 'correct')],
         ]
         const result = calculateSkillIndexJuly2026({
            attempts: 2,
            maxAttempts: 2,
            usedHint: false,
            guesses,
         })
         const sumRows = result.rows.reduce((a, b) => a + b, 0)
         expect(result.nearlyGotIt).toBe(0)
         expect(result.bonus).toBe(sumRows)
         expect(result.finalScore).toBe(sumRows)
      })
   })
})
