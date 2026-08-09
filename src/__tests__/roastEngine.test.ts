import { describe, it, expect } from 'vitest';
import { generateRoast, analyzeGame } from '../utils/roastEngine';
import type { GuessResult } from '../types/game';

describe('Roast Engine & Logic Analyzer', () => {
    it('detects duplicate guesses correctly', () => {
        const guesses: GuessResult[][] = [
            [
                { letter: 'S', status: 'absent' },
                { letter: 'T', status: 'absent' },
                { letter: 'A', status: 'absent' },
                { letter: 'R', status: 'absent' },
                { letter: 'E', status: 'absent' },
            ],
            [
                { letter: 'S', status: 'absent' },
                { letter: 'T', status: 'absent' },
                { letter: 'A', status: 'absent' },
                { letter: 'R', status: 'absent' },
                { letter: 'E', status: 'absent' },
            ],
        ];

        const analysis = analyzeGame(guesses, 'PLANT');
        expect(analysis.duplicateGuesses).toContain('stare');

        const roast = generateRoast(guesses, 'PLANT', false, false, 2);
        expect(roast).toMatch(/STARE/);
    });

    it('distinguishes between brutal hint roasts and mild hint roasts', () => {
        const guesses: GuessResult[][] = [
            [
                { letter: 'P', status: 'correct' },
                { letter: 'L', status: 'correct' },
                { letter: 'A', status: 'correct' },
                { letter: 'N', status: 'absent' },
                { letter: 'E', status: 'absent' },
            ],
        ];

        // Brutal: Used hint on row 1 with 3 greens already revealed!
        const brutalRoast = generateRoast(
            guesses,
            'PLANT',
            true,
            true,
            2,
            { letter: 'T', index: 4, row: 1 }
        );
        expect(brutalRoast).toMatch(/hint|assistance|lazy|surrender|ChatGPT|teach|bailout/i);

        // Mild: Used hint on row 5 after struggling
        const mildGuesses: GuessResult[][] = [
            [
                { letter: 'S', status: 'absent' },
                { letter: 'T', status: 'present' },
                { letter: 'A', status: 'absent' },
                { letter: 'R', status: 'absent' },
                { letter: 'E', status: 'absent' },
            ],
            [
                { letter: 'C', status: 'absent' },
                { letter: 'H', status: 'absent' },
                { letter: 'I', status: 'absent' },
                { letter: 'M', status: 'absent' },
                { letter: 'E', status: 'absent' },
            ],
            [
                { letter: 'B', status: 'absent' },
                { letter: 'O', status: 'absent' },
                { letter: 'U', status: 'absent' },
                { letter: 'N', status: 'present' },
                { letter: 'D', status: 'absent' },
            ],
            [
                { letter: 'F', status: 'absent' },
                { letter: 'L', status: 'correct' },
                { letter: 'O', status: 'absent' },
                { letter: 'C', status: 'absent' },
                { letter: 'K', status: 'absent' },
            ],
        ];

        const mildRoast = generateRoast(
            mildGuesses,
            'PLANT',
            true,
            true,
            5,
            { letter: 'P', index: 0, row: 4 }
        );
        expect(mildRoast).toMatch(/hint|training|win|lifeline|humble/i);
    });

    it('identifies strategic burner rows with 4+ fresh letters', () => {
        const guesses: GuessResult[][] = [
            [
                { letter: 'P', status: 'correct' },
                { letter: 'L', status: 'correct' },
                { letter: 'A', status: 'correct' },
                { letter: 'N', status: 'absent' },
                { letter: 'S', status: 'absent' },
            ],
            // Burner row omitting PLA but testing 5 brand new letters (G, O, U, R, D)
            [
                { letter: 'G', status: 'absent' },
                { letter: 'O', status: 'absent' },
                { letter: 'U', status: 'absent' },
                { letter: 'R', status: 'absent' },
                { letter: 'D', status: 'absent' },
            ],
        ];

        const analysis = analyzeGame(guesses, 'PLANT');
        expect(analysis.strategicDiscards.length).toBeGreaterThan(0);
        expect(analysis.strategicDiscards[0].newLettersCount).toBeGreaterThanOrEqual(4);

        const roast = generateRoast(guesses, 'PLANT', false, true, 3);
        expect(roast).toMatch(/Kasparov|4D chess|burner|tactical|fresh|vowels|genius/i);
    });

    it('detects green letter loss blunders', () => {
        const guesses: GuessResult[][] = [
            [
                { letter: 'P', status: 'correct' },
                { letter: 'L', status: 'absent' },
                { letter: 'A', status: 'absent' },
                { letter: 'N', status: 'absent' },
                { letter: 'T', status: 'absent' },
            ],
            // Changed P at index 0 to S without testing new letters
            [
                { letter: 'S', status: 'absent' },
                { letter: 'P', status: 'absent' },
                { letter: 'A', status: 'absent' },
                { letter: 'R', status: 'absent' },
                { letter: 'E', status: 'absent' },
            ],
        ];

        const analysis = analyzeGame(guesses, 'PLANT');
        expect(analysis.greenLosses.length).toBeGreaterThan(0);
        expect(analysis.greenLosses[0].letter).toBe('P');
    });

    it('detects gray letter reuses', () => {
        const guesses: GuessResult[][] = [
            [
                { letter: 'S', status: 'absent' },
                { letter: 'T', status: 'absent' },
                { letter: 'A', status: 'absent' },
                { letter: 'R', status: 'absent' },
                { letter: 'E', status: 'absent' },
            ],
            [
                { letter: 'S', status: 'absent' },
                { letter: 'O', status: 'absent' },
                { letter: 'U', status: 'absent' },
                { letter: 'L', status: 'correct' },
                { letter: 'S', status: 'absent' },
            ],
        ];

        const analysis = analyzeGame(guesses, 'PLANT');
        expect(analysis.grayReuses).toContain('S');

        const roast = generateRoast(guesses, 'PLANT', false, false, 2);
        expect(roast).toMatch(/S/);
    });
});
