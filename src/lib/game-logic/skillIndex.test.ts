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
runTest("Legacy System (Win in 1)", calculateSkillIndex({ attempts: 1, maxAttempts: 6, usedHint: false, guesses: legacyGuesses, gameDate: '2026-05-17' }), 1075);

/**
 * 2. New System: Win in 2
 * Word: TRACE
 * Row 0: TRIED (T,R correct, I,E,D absent)
 * Row 1: TRACE (Win)
 */
const winIn2Guesses = [
    [g('T', 'correct'), g('R', 'correct'), g('I', 'absent'), g('E', 'absent'), g('D', 'absent')],
    [g('T', 'correct'), g('R', 'correct'), g('A', 'correct'), g('C', 'correct'), g('E', 'correct')]
];
/**
 * Calculation:
 * Base Score: (6-2+1)/6 * 1000 = 833
 * Row 0 Points:
 *   - T correct: 60
 *   - R correct: 60
 *   - I absent: -5
 *   - E absent: -5
 *   - D absent: -5
 *   Row 0 total: 105
 * Row 1 Points:
 *   - T correct (old): 0
 *   - R correct (old): 0
 *   - A correct (fresh): 40
 *   - C correct (fresh): 40
 *   - E correct (fresh): 40
 *   Row 1 total: 120
 * Total Skill Index: 833 + 105 + 120 = 1058
 */
runTest("New System (Win in 2)", calculateSkillIndex({ attempts: 2, maxAttempts: 6, usedHint: false, guesses: winIn2Guesses, gameDate: '2026-05-18' }), 1058);

/**
 * 3. New System: Duplicate Letter Discovery (Entity-based)
 * Word: STEEL
 * Row 0: SEEDS (S correct, E present, E absent, D absent, S absent)
 */
const duplicateGuesses = [
    [g('S', 'correct'), g('E', 'present'), g('E', 'absent'), g('D', 'absent'), g('S', 'absent')],
    [g('S', 'correct'), g('T', 'correct'), g('E', 'correct'), g('E', 'correct'), g('L', 'correct')]
];
/**
 * Calculation:
 * Base Score: (6-2+1)/6 * 1000 = 833
 * Row 0 Points:
 *   - S correct: 60
 *   - E present: 25
 *   - E absent: -5
 *   - D absent: -5
 *   - S absent: -5
 *   Row 0 total: 70
 * Row 1 Points:
 *   - S correct (old): 0
 *   - T correct (fresh): 40
 *   - E correct (old yellow): 0
 *   - E correct (old yellow): 0
 *   - L correct (fresh): 40
 *   Row 1 total: 80
 * Total Skill Index: 833 + 70 + 80 = 983
 */
runTest("New System (STEEL duplicate logic)", calculateSkillIndex({ attempts: 2, maxAttempts: 6, usedHint: false, guesses: duplicateGuesses, gameDate: '2026-05-18' }), 983);

/**
 * 4. New System: Failing to win (Losing Bug Fix)
 * Word: APPLE
 * Row 0: ZZZZZ (absent)
 * Row 1: APPLY (A,P,P,L correct, Y absent)
 */
const lossGuesses = [
    [g('Z', 'absent'), g('Z', 'absent'), g('Z', 'absent'), g('Z', 'absent'), g('Z', 'absent')], // Row 0: -25
    [g('A', 'correct'), g('P', 'correct'), g('P', 'correct'), g('L', 'correct'), g('Y', 'absent')] // Row 1: 40 + 40 + 0 + 40 - 5 = 115
];
/**
 * Calculation:
 * Base Score: 0 (Loss)
 * Row 0 Bonus: -25
 * Row 1 Bonus: 115
 * Total Skill Index: 90
 */
runTest("New System (Fail - No Payoff)", calculateSkillIndex({ attempts: 2, maxAttempts: 6, usedHint: false, guesses: lossGuesses, gameDate: '2026-05-18' }), 90);

/**
 * 5. New System: Repeat Mistake Penalty (-20)
 * Word: APPLE
 * Row 0: ZZZZZ (-25, Z added to knownBlacks)
 * Row 1: ZZZZZ (-100, 5 * -20)
 */
const repeatMistakeGuesses = [
    [g('Z', 'absent'), g('Z', 'absent'), g('Z', 'absent'), g('Z', 'absent'), g('Z', 'absent')],
    [g('Z', 'absent'), g('Z', 'absent'), g('Z', 'absent'), g('Z', 'absent'), g('Z', 'absent')]
];
// Row 0: -25. Row 1: -100. Total: -125.
runTest("New System (Repeat Strategic Mistake)", calculateSkillIndex({ attempts: 2, maxAttempts: 6, usedHint: false, guesses: repeatMistakeGuesses, gameDate: '2026-05-18' }), -125);

/**
 * 6. New System: Hint Penalty
 * Word: APPLE
 * Win in 1 with hint used
 */
const hintRecordWithRow = { index: 2, letter: 'P', row: 1 };
runTest("New System (Win with Hint)", calculateSkillIndex({ attempts: 1, maxAttempts: 6, usedHint: true, guesses: legacyGuesses, gameDate: '2026-05-18', hintRecord: hintRecordWithRow }), 1200);
// Base: 1000. Row 0: 300. Hint: -100. Total: 1200.

