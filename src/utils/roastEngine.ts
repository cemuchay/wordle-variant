import { type GuessResult } from '../types/game';
import { getWinMessage, getLossMessage } from '../lib/messages';

export interface RoastAnalysis {
    grayReuses: string[];        // letters that are not in the word but reused
    greenLosses: { letter: string; index: number; row: number; changedTo: string }[];
    yellowRepeatedSpots: { letter: string; index: number; row: number }[];
    yellowOmitted: { letter: string; row: number }[];
    duplicateGuesses: string[];
}

/**
 * Scans guesses row-by-row to detect logical mistakes against information revealed in previous rows.
 */
export function analyzeGame(
    guesses: GuessResult[][],
    targetWord: string
): RoastAnalysis {
    const targetLower = targetWord.toLowerCase();
    const targetLetters = targetLower.split('');

    const grayReuses: string[] = [];
    const greenLosses: { letter: string; index: number; row: number; changedTo: string }[] = [];
    const yellowRepeatedSpots: { letter: string; index: number; row: number }[] = [];
    const yellowOmitted: { letter: string; row: number }[] = [];
    const duplicateGuesses: string[] = [];

    // Reconstruct words guessed
    const guessedWords: string[] = guesses.map(g => g.map(c => c.letter.toLowerCase()).join(''));

    // Check duplicate words
    const seenWords = new Set<string>();
    guessedWords.forEach(w => {
        if (seenWords.has(w)) {
            duplicateGuesses.push(w);
        }
        seenWords.add(w);
    });

    const targetLettersSet = new Set(targetLetters);

    // Track letter status states up to previous rows
    const greensAtRow: Record<number, string> = {}; // index -> letter
    const yellowsAtRow: Record<string, Set<number>> = {}; // letter -> Set of invalid indices
    const graysDetected = new Set<string>(); // letters completely absent from target word

    for (let r = 0; r < guesses.length; r++) {
        const currentGuess = guesses[r];
        const currentWord = guessedWords[r];

        // Check mistakes against accumulated knowledge
        if (r > 0) {
            // 1. Check green losses
            for (const [idxStr, prevLetter] of Object.entries(greensAtRow)) {
                const idx = parseInt(idxStr);
                const currentLetter = currentGuess[idx]?.letter?.toLowerCase();
                if (currentLetter && currentLetter !== prevLetter) {
                    greenLosses.push({
                        letter: prevLetter.toUpperCase(),
                        index: idx,
                        row: r + 1,
                        changedTo: currentLetter.toUpperCase()
                    });
                }
            }

            // 2. Check gray reuses
            for (let i = 0; i < currentGuess.length; i++) {
                const char = currentGuess[i]?.letter?.toLowerCase();
                if (char && graysDetected.has(char)) {
                    if (!grayReuses.includes(char.toUpperCase())) {
                        grayReuses.push(char.toUpperCase());
                    }
                }
            }

            // 3. Check yellow violations
            const currentLettersInGuess = new Set(currentWord.split(''));
            for (const [yLetter, prevIndices] of Object.entries(yellowsAtRow)) {
                if (!currentLettersInGuess.has(yLetter)) {
                    yellowOmitted.push({
                        letter: yLetter.toUpperCase(),
                        row: r + 1
                    });
                } else {
                    for (let i = 0; i < currentGuess.length; i++) {
                        const char = currentGuess[i]?.letter?.toLowerCase();
                        if (char === yLetter && prevIndices.has(i)) {
                            yellowRepeatedSpots.push({
                                letter: yLetter.toUpperCase(),
                                index: i,
                                row: r + 1
                            });
                        }
                    }
                }
            }
        }

        // Update accumulated knowledge from current guess
        for (let i = 0; i < currentGuess.length; i++) {
            const charObj = currentGuess[i];
            if (!charObj) continue;
            const char = charObj.letter.toLowerCase();

            if (charObj.status === 'correct') {
                greensAtRow[i] = char;
            } else if (charObj.status === 'present') {
                if (!yellowsAtRow[char]) {
                    yellowsAtRow[char] = new Set<number>();
                }
                yellowsAtRow[char].add(i);
            } else if (charObj.status === 'absent') {
                if (!targetLettersSet.has(char)) {
                    graysDetected.add(char);
                }
            }
        }
    }

    return {
        grayReuses,
        greenLosses,
        yellowRepeatedSpots,
        yellowOmitted,
        duplicateGuesses
    };
}

/**
 * Generates a highly personalized, sarcastic roast based on the gameplay.
 * Falls back to existing message pools in messages.ts if no specific logic errors are detected.
 */
export function generateRoast(
    guesses: GuessResult[][],
    targetWord: string,
    usedHint: boolean,
    won: boolean,
    attempts: number
): string {
    // 1. Run row-by-row logical analysis
    const analysis = analyzeGame(guesses, targetWord);

    // 2. Fetch the standard/existing congratulatory/roast message
    const baseMessage = won ? getWinMessage(attempts) : getLossMessage();

    // 3. Prioritize logic-based roasts
    // Scenario A: Duplicate guess words (highest penalty)
    if (analysis.duplicateGuesses.length > 0) {
        const dup = analysis.duplicateGuesses[0].toUpperCase();
        const dupRoasts = [
            `Losing is one thing, but guessing "${dup}" twice? Are you okay?`,
            `You literally guessed "${dup}" multiple times. Bold waste of a row.`,
            `Guessing "${dup}" twice in one game? That's some legendary short-term memory loss.`
        ];
        return dupRoasts[Math.floor(Math.random() * dupRoasts.length)];
    }

    // Scenario B: Hint usage
    if (usedHint && won) {
        const hintRoasts = [
            `A win in ${attempts}... but with a hint? That's like using training wheels on a stationary bike.`,
            `You won, but you needed a hint. It's giving "I ask Google for help in arguments".`,
            `Congrats on the win, but that hint kinda ruins the flex.`
        ];
        return hintRoasts[Math.floor(Math.random() * hintRoasts.length)];
    }

    // Scenario C: Green letter loss
    if (analysis.greenLosses.length > 0) {
        const loss = analysis.greenLosses[0];
        const greenRoasts = [
            `You had "${loss.letter}" locked in green at spot ${loss.index + 1} on row ${loss.row - 1}, but changed it to "${loss.changedTo}" in row ${loss.row}? Absolute self-sabotage.`,
            `Wait, row ${loss.row - 1} told you "${loss.letter}" was in spot ${loss.index + 1}. Why did you guess "${loss.changedTo}" there in row ${loss.row}?`,
            `Green letters are meant to be kept, not discarded. What was the plan with "${loss.changedTo}" at spot ${loss.index + 1}?`
        ];
        return greenRoasts[Math.floor(Math.random() * greenRoasts.length)];
    }

    // Scenario D: Reusing dead gray letters
    if (analysis.grayReuses.length > 0) {
        const letters = analysis.grayReuses.slice(0, 2).join(', ');
        const grayRoasts = [
            `Reusing gray letters ("${letters}")? Are you allergic to the process of elimination?`,
            `Guessed dead letters like "${letters}" again? Stop guessing letters that are already marked gray!`,
            `Those gray tiles aren't just for decoration. Why did you reuse "${letters}"?`
        ];
        return grayRoasts[Math.floor(Math.random() * grayRoasts.length)];
    }

    // Scenario E: Placing yellow letter in the same invalid spot
    if (analysis.yellowRepeatedSpots.length > 0) {
        const repeat = analysis.yellowRepeatedSpots[0];
        const yellowRepeatRoasts = [
            `You put "${repeat.letter}" in spot ${repeat.index + 1} again, even though row ${repeat.row - 1} already said it doesn't belong there.`,
            `Yellow means "present but wrong spot". Yet you guessed "${repeat.letter}" in the exact same spot on row ${repeat.row}. Great job.`,
            `Why put "${repeat.letter}" back in spot ${repeat.index + 1} on row ${repeat.row}? Did you expect the rules to change mid-game?`
        ];
        return yellowRepeatRoasts[Math.floor(Math.random() * yellowRepeatRoasts.length)];
    }

    // Scenario F: Omitting a known yellow letter
    if (analysis.yellowOmitted.length > 0) {
        const omit = analysis.yellowOmitted[0];
        const yellowOmitRoasts = [
            `Row ${omit.row - 1} told you "${omit.letter}" is in the word. So why did you guess a word without it on row ${omit.row}?`,
            `Completely forgetting about the yellow "${omit.letter}" on row ${omit.row}? Bold strategy.`,
            `You left out "${omit.letter}" in row ${omit.row} even though it's a confirmed present letter.`
        ];
        return yellowOmitRoasts[Math.floor(Math.random() * yellowOmitRoasts.length)];
    }

    // Fallback to baseline congratulatory or tier messages
    return baseMessage;
}
