import { calculateSkillIndex } from './index';

// Mock GuessResult for testing
const g = (letter: string, status: 'correct' | 'present' | 'absent'): any => ({ letter, status });

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

// 3. New system: Fail test
const failGuesses = [
    [g('A', 'absent'), g('B', 'absent'), g('C', 'absent'), g('D', 'absent'), g('E', 'absent')], // -25
    [g('A', 'absent'), g('B', 'absent'), g('C', 'absent'), g('D', 'absent'), g('E', 'absent')], // -100 (repeated)
    [g('A', 'absent'), g('B', 'absent'), g('C', 'absent'), g('D', 'absent'), g('E', 'absent')], // -100
    [g('A', 'absent'), g('B', 'absent'), g('C', 'absent'), g('D', 'absent'), g('E', 'absent')], // -100
    [g('A', 'absent'), g('B', 'absent'), g('C', 'absent'), g('D', 'absent'), g('E', 'absent')], // -100
    [g('A', 'absent'), g('B', 'absent'), g('C', 'absent'), g('D', 'absent'), g('E', 'absent')]  // -100
];
// Base score: 0 (lost)
// Bonus: -25 - 100*5 = -525
runTest("New System (Fail)", calculateSkillIndex(6, 6, false, failGuesses, '2026-05-18'), -525);

// 4. Hint penalty
runTest("New System (Win in 1 with Hint)", calculateSkillIndex(1, 6, true, oldGuesses, '2026-05-18'), 1100); 
// Base: 1000, Hint: -100, Bonus: 5*40=200. Total: 1100.
