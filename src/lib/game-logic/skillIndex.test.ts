import { calculateSkillIndex } from './index';
import type { GuessResult } from '../../types/game';

// Mock GuessResult for testing
const g = (letter: string, status: 'correct' | 'present' | 'absent'): GuessResult => ({ letter, status });

console.log("Running Skill Index Tests (Payoff + Deduction Model)...");

const runTest = (name: string, result: number, expected: number) => {
    if (result === expected) {
        console.log(`✅ ${name}: ${result}`);
    } else {
        console.error(`❌ ${name}: Expected ${expected}, got ${result}`);
    }
};

/**
 * 1. Old system test (Pre-May 18)
 * Algorithm: (maxAttempts - attempts + 1) / maxAttempts * 1000 + bonuses (15 correct, 2 present, -10 absent)
 */
const legacyGuesses = [
    [g('A', 'correct'), g('P', 'correct'), g('P', 'correct'), g('L', 'correct'), g('E', 'correct')]
];
// Legacy: (6-1+1)/6*1000 = 1000. Bonus: 15*5 = 75. Total: 1075.
runTest("Legacy System (Win in 1)", calculateSkillIndex(1, 6, false, legacyGuesses, 'APPLE', '2026-05-17'), 1075);

/**
 * 2. New System: Win in 2
 * Word: TRACE
 * Row 1: TRIED (T,R correct, I,E,D absent)
 * Row 2: TRACE (Win)
 */
const winIn2Guesses = [
    [g('T', 'correct'), g('R', 'correct'), g('I', 'absent'), g('E', 'absent'), g('D', 'absent')],
    [g('T', 'correct'), g('R', 'correct'), g('A', 'correct'), g('C', 'correct'), g('E', 'correct')]
];
/**
 * Calculation:
 * Base Score: (6-2+1)/6 * 1000 = 833
 * Row 1 Bonus: 
 *   - T correct: 0 deduction
 *   - R correct: 0 deduction
 *   - I absent (new): -5
 *   - E absent (known letter in wrong spot): -5
 *   - D absent (new): -5
 *   Row 1 total: -15
 * Row 2 Bonus (Payoff Row):
 *   - Payoff: 5 * 40 = 200
 *   Row 2 total: 200
 * Total Skill Index: 833 + (-15) + 200 = 1018
 */
runTest("New System (Win in 2)", calculateSkillIndex(2, 6, false, winIn2Guesses, 'TRACE', '2026-05-18'), 1018);

/**
 * 3. New System: Duplicate Letter Discovery (Entity-based)
 * Word: STEEL
 * Row 1: SEEDS (S correct, E present, E absent, D absent, S absent)
 */
const duplicateGuesses = [
    [g('S', 'correct'), g('E', 'present'), g('E', 'absent'), g('D', 'absent'), g('S', 'absent')],
    [g('S', 'correct'), g('T', 'correct'), g('E', 'correct'), g('E', 'correct'), g('L', 'correct')]
];
/**
 * Calculation:
 * Base Score: (6-2+1)/6 * 1000 = 833
 * Row 1 Bonus:
 *   - S correct: 0
 *   - E present: -15
 *   - E absent (known letter): -5
 *   - D absent (new): -5
 *   - S absent (known letter): -5
 *   Row 1 total: -30
 * Row 2 Bonus:
 *   - Payoff: 5 * 40 = 200
 *   Row 2 total: 200
 * Total Skill Index: 833 - 30 + 200 = 1003
 */
runTest("New System (STEEL duplicate logic)", calculateSkillIndex(2, 6, false, duplicateGuesses, 'STEEL', '2026-05-18'), 1003);

/**
 * 4. New System: Failing to win (Losing Bug Fix)
 * Word: APPLE
 * Final Row: APPLY (A,P,P,L correct, Y absent)
 */
const lossGuesses = [
    [g('Z', 'absent'), g('Z', 'absent'), g('Z', 'absent'), g('Z', 'absent'), g('Z', 'absent')], // Row 1: -25
    [g('A', 'correct'), g('P', 'correct'), g('P', 'correct'), g('L', 'correct'), g('Y', 'absent')] // Row 2 (Loss): 0 payoffs. A,P,P,L (Greens) = 0. Y (New) = -5.
];
/**
 * Calculation:
 * Base Score: 0 (Loss)
 * Row 1 Bonus: -25
 * Row 2 Bonus: -5
 * Total Skill Index: -30
 */
runTest("New System (Fail - No Payoff)", calculateSkillIndex(2, 6, false, lossGuesses, 'APPLE', '2026-05-18'), -30);

/**
 * 5. New System: Repeat Mistake Penalty (-20)
 * Word: APPLE
 * Row 1: ZZZZZ (-25, Z added to knownBlacks)
 * Row 2: ZZZZZ (-100, 5 * -20)
 */
const repeatMistakeGuesses = [
    [g('Z', 'absent'), g('Z', 'absent'), g('Z', 'absent'), g('Z', 'absent'), g('Z', 'absent')],
    [g('Z', 'absent'), g('Z', 'absent'), g('Z', 'absent'), g('Z', 'absent'), g('Z', 'absent')]
];
// Row 1: -25. Row 2: -100. Total: -125.
runTest("New System (Repeat Strategic Mistake)", calculateSkillIndex(2, 6, false, repeatMistakeGuesses, 'APPLE', '2026-05-18'), -125);

/**
 * 6. New System: Hint Penalty
 * Word: APPLE
 * Win in 1 with hint used
 */
const hintRecord = { index: 2, letter: 'P' };
runTest("New System (Win with Hint)", calculateSkillIndex(1, 6, true, legacyGuesses, 'APPLE', '2026-05-18', hintRecord), 1100);
// Base: 1000. Hint: -100. Payoff: 5 * 40 = 200. Total: 1000 - 100 + 200 = 1100.
// Note: Deductions (hints_used/hint_record) don't affect payoff row currently in payoff model, they are handled at engine level.
