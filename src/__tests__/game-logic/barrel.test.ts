import { describe, it, expect } from 'vitest'
import * as gameLogic from '../../lib/game-logic'

describe('barrel exports', () => {
   const expectedExports = [
      'getLetterStatuses',
      'getWordAtDate',
      'getRandomWord',
      'obfuscateWord',
      'deobfuscateWord',
      'encryptGuesses',
      'decryptGuesses',
      'getDailyConfig',
      'getUnconstrainedDailyConfig',
      'checkGuess',
      'isHintDisabled',
      'getHint',
      'updateStats',
      'syncStatsFromLocalStorage',
      'fetchAndSyncCloudStats',
      'calculateSkillIndex',
      'syncGameState',
      'syncWithRetry',
      'isGuessCompatible',
      'getShapeShifterFeedbackAndWord',
   ]

   expectedExports.forEach(name => {
      it(`exports ${name}`, () => {
         expect(gameLogic).toHaveProperty(name)
         expect(typeof (gameLogic as any)[name]).toBe('function')
      })
   })

   it('has no unexpected exports beyond expected ones', () => {
      const exportedNames = Object.keys(gameLogic)
      const extra = exportedNames.filter(n => !expectedExports.includes(n))
      expect(extra).toEqual([])
   })
})
