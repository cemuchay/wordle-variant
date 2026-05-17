import { calculateSkillIndex } from './index';
import type { GuessResult } from '../../types/game';

// Mock GuessResult for testing
const g = (letter: string, status: 'correct' | 'present' | 'absent'): GuessResult => ({ letter, status });

console.log("Running Skill Index Tests...");

const runTest = (name: string, result: number, expected: number) => {
    if (result === expected) {
        console.log(`✅ ${name}: ${result}`);
    } else {
        console.error(`❌ ${name}: Expected ${expected}, got ${result}`);
    }
};

// 1. Old system test (Pre-May 18)
const oldGuesses = [
    [g('A', 'correct'), g('P', 'correct'), g('P', 'correct'), g('L', 'correct'), g('E', 'correct')]
];
// Legacy: (6-1+1)/6*1000 = 1000. Bonus: 15*5 = 75. Total: 1075.
runTest("Legacy System (Win in 1)", calculateSkillIndex(1, 6, false, oldGuesses, '2026-05-17'), 1075);

// 2. New system: Win in 3, no hints, some discoveries
const newGuesses = [
    [g('A', 'present'), g('B', 'absent'), g('C', 'absent'), g('D', 'absent'), g('E', 'absent')], // A yellow at 0 (+25), B,C,D,E black (-20) -> bonus +5
    [g('F', 'absent'), g('A', 'correct'), g('C', 'absent'), g('D', 'absent'), g('E', 'absent')], // F black (-5), A green at 1 (+40), C,D,E black repeated (-60) -> bonus -25
    [g('G', 'correct'), g('A', 'correct'), g('H', 'correct'), g('I', 'correct'), g('J', 'correct')] // G,H,I,J green (+160), A green repeated (0) -> bonus +160
];
// Total bonus: 5 - 25 + 160 = 140
// Base score: (6-3+1)/6 * 1000 = 666.6 -> 666
// Total: 666 + 140 = 806
runTest("New System (Win in 3)", calculateSkillIndex(3, 6, false, newGuesses, '2026-05-18'), 806);

// 3. New system: Fail test (with repeated blacks across rows vs same row)
const failGuesses = [
    [g('E', 'absent'), g('E', 'absent'), g('R', 'absent'), g('I', 'absent'), g('E', 'absent')], // First row: E is new. All 3 Es are new black. 5 * (-5) = -25.
    [g('E', 'absent'), g('A', 'absent'), g('G', 'absent'), g('L', 'absent'), g('E', 'absent')], // Second row: E is known black! 2 Es = 2 * (-20) = -40. A,G,L new = -15. Total = -55.
    [g('A', 'absent'), g('B', 'absent'), g('C', 'absent'), g('D', 'absent'), g('F', 'absent')], // Third row: A is known black = -20. B,C,D,F new = -20. Total = -40.
];
// Base score: 0 (lost)
// Bonus: -25 - 55 - 40 = -120
runTest("New System (Fail - Black Letter Penalties)", calculateSkillIndex(6, 6, false, failGuesses, '2026-05-18'), -120);

// 4. New system: Yellow to Green placement test
// const yellowToGreen = [
//     [g('S', 'present'), g('T', 'absent'), g('A', 'absent'), g('R', 'absent'), g('E', 'absent')], // S yellow at 0 (+25), others black (-20) -> bonus +5
//     [g('S', 'correct'), g('L', 'absent'), g('E', 'absent'), g('E', 'absent'), g('P', 'absent')]  // S green at 0 (+0, already scored as yellow), others black (-10, L -5, E -5, E -20, P -5) wait...
// ];
// Wait, let's trace Row 2:
// cell 0 (S): correct. index 0 already in scoredIndices. bonus +0.
// cell 1 (L): absent. new black. bonus -5.
// cell 2 (E): absent. new black. bonus -5.
// cell 3 (E): absent. repeated black. bonus -20.
// cell 4 (P): absent. new black. bonus -5.
// Row 2 bonus: -35.
// Total bonus: 5 - 35 = -30.
// If this was Row 2 win (unrealistic but for score testing): (6-2+1)/6*1000 = 833.
// Total: 833 - 30 = 803.
// Let's make it win in 2 for simplicity.
const winIn2YellowToGreen = [
    [g('S', 'present'), g('O', 'absent'), g('U', 'absent'), g('N', 'absent'), g('D', 'absent')], // S yellow at 0 (+25), O,U,N,D black (-20) -> bonus +5
    [g('S', 'correct'), g('A', 'correct'), g('R', 'correct'), g('E', 'correct'), g('D', 'correct')] // S green at 0 (+0), A,R,E green at 1,2,3 (+120), D green at 4 (+0, D was black before!)
];
// Wait, D was black in Row 1. Now it's Green in Row 2.
// cell 4 (D): correct. index 4 already in scoredIndices? No, Row 1 index 4 was Black.
// Wait, my code only adds to scoredIndices for Green/Yellow.
// cell 4 (D) in Row 2: index 4 not in scoredIndices. bonus +40.
// Row 2 bonus: 120 + 40 = 160.
// Total bonus: 5 + 160 = 165.
// Base score (win in 2): 833.
// Total: 833 + 165 = 998.
runTest("New System (Yellow to Green Placement)", calculateSkillIndex(2, 6, false, winIn2YellowToGreen, '2026-05-18'), 998);

// 5. Hint penalty & No discovery bonus for hinted letter
const hintRecord = { index: 2, letter: 'P' }; // Hint revealed 'P' at index 2
const winWithHint = [
    [g('A', 'correct'), g('P', 'correct'), g('P', 'correct'), g('L', 'correct'), g('E', 'correct')]
];
// Base: 1000
// Hint: -100
// Bonus: 4 Green discoveries at indices 0, 1, 3, 4. Index 2 is ignored due to hintRecord.
// 4 * 40 = 160
// Total: 1000 - 100 + 160 = 1060
runTest("New System (Win in 1 with Hint & No Double Score)", calculateSkillIndex(1, 6, true, winWithHint, '2026-05-18', hintRecord), 1060);

// 6. Existing Hint penalty test (without hintRecord passed, it would still award points - this verifies fallback/backwards compat if needed, but we should always pass it now)
runTest("New System (Win in 1 with Hint - Legacy call)", calculateSkillIndex(1, 6, true, oldGuesses, '2026-05-18'), 1100);
// Base: 1000, Hint: -100, Bonus: 5*40=200. Total: 1100.
