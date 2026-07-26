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
})
