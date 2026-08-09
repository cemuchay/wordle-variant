import { type GuessResult } from '../types/game';
import { getWinMessage, getLossMessage } from '../lib/messages';

export interface RoastAnalysis {
    grayReuses: string[];        // letters that are not in the word but reused
    greenLosses: { letter: string; index: number; row: number; changedTo: string }[];
    yellowRepeatedSpots: { letter: string; index: number; row: number }[];
    yellowOmitted: { letter: string; row: number }[];
    duplicateGuesses: string[];
    strategicDiscards: { row: number; newLettersCount: number }[];
}

/**
 * Scans guesses row-by-row to detect logical mistakes, strategic burner rows,
 * and information violations revealed in previous rows.
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
    const strategicDiscards: { row: number; newLettersCount: number }[] = [];

    // Reconstruct words guessed
    const guessedWords: string[] = guesses.map(g => g.map(c => (c.letter || (c as any).char || '').toLowerCase()).join(''));

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
    const allSeenLetters = new Set<string>(); // all letters used in prior guesses

    for (let r = 0; r < guesses.length; r++) {
        const currentGuess = guesses[r];
        const currentWord = guessedWords[r];

        // Check mistakes & strategic choices against accumulated knowledge
        if (r > 0) {
            let omittedGreenOrYellow = false;

            // 1. Check green losses
            for (const [idxStr, prevLetter] of Object.entries(greensAtRow)) {
                const idx = parseInt(idxStr);
                const currentLetter = currentGuess[idx]?.letter?.toLowerCase();
                if (currentLetter && currentLetter !== prevLetter) {
                    omittedGreenOrYellow = true;
                    greenLosses.push({
                        letter: prevLetter.toUpperCase(),
                        index: idx,
                        row: r + 1,
                        changedTo: currentLetter.toUpperCase()
                    });
                }
            }

            // 2. Check gray reuses
            let reusedGrayInThisRow = false;
            for (let i = 0; i < currentGuess.length; i++) {
                const char = (currentGuess[i]?.letter || (currentGuess[i] as any)?.char || '').toLowerCase();
                if (char && graysDetected.has(char)) {
                    reusedGrayInThisRow = true;
                    if (!grayReuses.includes(char.toUpperCase())) {
                        grayReuses.push(char.toUpperCase());
                    }
                }
            }

            // 3. Check yellow violations & omissions
            const currentLettersInGuess = new Set(currentWord.split(''));
            for (const [yLetter, prevIndices] of Object.entries(yellowsAtRow)) {
                if (!currentLettersInGuess.has(yLetter)) {
                    omittedGreenOrYellow = true;
                    yellowOmitted.push({
                        letter: yLetter.toUpperCase(),
                        row: r + 1
                    });
                } else {
                    for (let i = 0; i < currentGuess.length; i++) {
                        const char = (currentGuess[i]?.letter || (currentGuess[i] as any)?.char || '').toLowerCase();
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

            // 4. Check for Strategic Discard (Burner Row)
            // A row is strategic if it omits known info BUT tests 4+ brand new letters with zero gray reuses!
            if (omittedGreenOrYellow && !reusedGrayInThisRow) {
                const rowLetters = currentWord.split('');
                let newLetterCount = 0;
                rowLetters.forEach(ch => {
                    if (!allSeenLetters.has(ch)) {
                        newLetterCount++;
                    }
                });

                if (newLetterCount >= 4) {
                    strategicDiscards.push({ row: r + 1, newLettersCount: newLetterCount });
                }
            }
        }

        // Update accumulated knowledge from current guess
        for (let i = 0; i < currentGuess.length; i++) {
            const charObj = currentGuess[i];
            if (!charObj) continue;
            const char = (charObj.letter || (charObj as any).char || '').toLowerCase();
            if (!char) continue;

            allSeenLetters.add(char);

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
        duplicateGuesses,
        strategicDiscards
    };
}

/**
 * Helper to count unique green/yellow letters revealed prior to a given row or state.
 */
function getKnownLettersCountUpTo(guesses: GuessResult[][], maxRow?: number): number {
    const known = new Set<string>();
    const limit = maxRow !== undefined ? Math.min(guesses.length, maxRow) : guesses.length;
    for (let r = 0; r < limit; r++) {
        for (const res of guesses[r] || []) {
            if (res.status === 'correct' || res.status === 'present') {
                const char = (res.letter || (res as any).char || '').toLowerCase();
                if (char) known.add(char);
            }
        }
    }
    return known.size;
}

/**
 * Generates a highly personalized, sarcastic roast based on the gameplay.
 * Evaluates duplicate guesses, strategic vs blunder discards, hint wisdom (mild vs brutal),
 * dead letter reuses, and yellow placement mistakes.
 */
export function generateRoast(
    guesses: GuessResult[][],
    targetWord: string,
    usedHint: boolean,
    won: boolean,
    attempts: number,
    hintRecord?: { letter: string; index: number; row: number } | null
): string {
    // 1. Run row-by-row logical analysis
    const analysis = analyzeGame(guesses, targetWord);

    // 2. Fetch standard fallback message
    const baseMessage = won ? getWinMessage(attempts) : getLossMessage();

    // SCENARIO A: Duplicate guess words (highest penalty)
    if (analysis.duplicateGuesses.length > 0) {
        const dup = analysis.duplicateGuesses[0].toUpperCase();
        const dupRoasts = [
            `Losing is one thing, but guessing "${dup}" twice? Are you okay?`,
            `You literally guessed "${dup}" multiple times. Bold waste of a row.`,
            `Guessing "${dup}" twice in one game? That's some legendary short-term memory loss.`,
            `You typed "${dup}" again like you were expecting a different dictionary.`,
            `Guessing "${dup}" twice? Even NEPA doesn't repeat mistakes with this much confidence.`,
            `Twice with "${dup}"? Somebody check if their keyboard is stuck on repeat.`,
            `You submitted "${dup}" twice. Your ancestors are in the background holding their foreheads.`
        ];
        return dupRoasts[Math.floor(Math.random() * dupRoasts.length)];
    }

    // SCENARIO B: Hint Usage (Mild vs. Brutal Paths)
    if (usedHint) {
        const hintRow = hintRecord?.row ?? Math.max(1, attempts - 2);
        const knownBeforeHint = getKnownLettersCountUpTo(guesses, hintRow);

        // Brutal path: Hint taken early (row 1 or 2) OR when 3+ letters were already revealed on the board!
        const isBrutalHint = hintRow <= 2 || knownBeforeHint >= 3;

        if (isBrutalHint) {
            const brutalHintRoasts = [
                `Using a hint on row ${hintRow + 1} with ${knownBeforeHint} letters already revealed? Did your brain request an emergency bailout?`,
                `A hint that early? You didn't even try. Full ChatGPT dependency behavior.`,
                `Asking for a hint with ${knownBeforeHint} letters on the board? That's not assistance, that's intellectual surrender.`,
                `You called for a hint like person wey dey call police because dem miss bus.`,
                `Using a hint that early? Your village people didn't even need to intervene, you gave up on your own.`,
                `A hint with ${knownBeforeHint} letters revealed? You basically asked the teacher for the answer key mid-exam.`,
                `You hit the hint button on row ${hintRow + 1}? Premium laziness detected.`
            ];
            return brutalHintRoasts[Math.floor(Math.random() * brutalHintRoasts.length)];
        } else {
            // Mild path: Hint taken late when genuinely stuck
            const mildHintRoasts = [
                `A win in ${attempts}... but with a hint? We'll count it, but training wheels were definitely active.`,
                `You won on row ${attempts}, but that hint saved you from a tragic public defeat.`,
                `Congrats on the win! That hint was like calling a friend for 50:50 on Who Wants to Be a Millionaire.`,
                `You got it in ${attempts} thanks to the hint. A win is a win, but your ego should remain humble.`,
                `You pulled off the win, but the hint did the heavy lifting on row ${hintRow + 1}.`,
                `Hint activated on row ${hintRow + 1}? Respect for surviving, but no trophy for bravado.`
            ];
            return mildHintRoasts[Math.floor(Math.random() * mildHintRoasts.length)];
        }
    }

    // SCENARIO C: Strategic Discard (Burner Row testing 4+ fresh letters)
    if (analysis.strategicDiscards.length > 0 && won) {
        const burner = analysis.strategicDiscards[0];
        const strategicRoasts = [
            `Sacrificing known letters on row ${burner.row} to test ${burner.newLettersCount} brand new letters? Look at Grandmaster Kasparov over here!`,
            `Discarding confirmed letters on row ${burner.row} for broader coverage? Either you're playing 4D chess or guessing blind.`,
            `Testing ${burner.newLettersCount} fresh letters on row ${burner.row}? Tactical burner row... or high-level panic. We'll pretend it was genius.`,
            `Omitting known letters to scan new vowels on row ${burner.row}? Sabi player behavior, no let it enter your head.`,
            `Bold burner guess on row ${burner.row}. You burned a row to buy information, and it actually paid off!`
        ];
        return strategicRoasts[Math.floor(Math.random() * strategicRoasts.length)];
    }

    // SCENARIO D: Green Letter Loss (Blunder / Self-Sabotage)
    if (analysis.greenLosses.length > 0) {
        const loss = analysis.greenLosses[0];
        const greenRoasts = [
            `You had "${loss.letter}" locked in green at spot ${loss.index + 1} on row ${loss.row - 1}, but changed it to "${loss.changedTo}" in row ${loss.row}? Absolute self-sabotage.`,
            `Wait, row ${loss.row - 1} told you "${loss.letter}" was in spot ${loss.index + 1}. Why did you guess "${loss.changedTo}" there in row ${loss.row}?`,
            `Green letters are meant to be kept, not discarded. What was the plan with "${loss.changedTo}" at spot ${loss.index + 1}?`,
            `You threw away confirmed green "${loss.letter}" on row ${loss.row}? What was the masterplan there?`,
            `Changing green "${loss.letter}" to "${loss.changedTo}" on row ${loss.row}? That's like throwing your passport out the window at airport check-in.`,
            `Row ${loss.row - 1} gave you green "${loss.letter}" at position ${loss.index + 1}. Row ${loss.row} said "nah, I don't believe you."`
        ];
        return greenRoasts[Math.floor(Math.random() * greenRoasts.length)];
    }

    // SCENARIO E: Reusing Dead Gray Letters
    if (analysis.grayReuses.length > 0) {
        const letters = analysis.grayReuses.slice(0, 2).join(', ');
        const grayRoasts = [
            `Reusing gray letters ("${letters}")? Are you allergic to the process of elimination?`,
            `Guessed dead letters like "${letters}" again? Stop guessing letters that are already marked gray!`,
            `Those gray tiles aren't just for decoration. Why did you reuse "${letters}"?`,
            `You saw "${letters}" turn gray and said "let me try it again, maybe it changed its mind."`,
            `Reusing gray letter "${letters}"? That's like calling your ex after they blocked you everywhere.`,
            `Gray means DEAD. OWO. Why are you exhuming "${letters}" on row ${analysis.grayReuses.length}?`,
            `You used "${letters}" again? Brother/Sister, gray is not a color option, it's an eviction notice.`,
            `Reusing "${letters}"? Your strategy is "vibes and selective amnesia."`
        ];
        return grayRoasts[Math.floor(Math.random() * grayRoasts.length)];
    }

    // SCENARIO F: Placing Yellow Letter in Same Invalid Spot
    if (analysis.yellowRepeatedSpots.length > 0) {
        const repeat = analysis.yellowRepeatedSpots[0];
        const yellowRepeatRoasts = [
            `You put "${repeat.letter}" in spot ${repeat.index + 1} again, even though row ${repeat.row - 1} already said it doesn't belong there.`,
            `Yellow means "present but wrong spot". Yet you guessed "${repeat.letter}" in the exact same spot on row ${repeat.row}. Great job.`,
            `Why put "${repeat.letter}" back in spot ${repeat.index + 1} on row ${repeat.row}? Did you expect the rules to change mid-game?`,
            `Placing "${repeat.letter}" at position ${repeat.index + 1} twice? Einstein defined insanity just for this moment.`,
            `Yellow "${repeat.letter}" at spot ${repeat.index + 1} again? The game literally highlighted it in yellow for you.`,
            `You put "${repeat.letter}" in spot ${repeat.index + 1} again like you were arguing with the server.`
        ];
        return yellowRepeatRoasts[Math.floor(Math.random() * yellowRepeatRoasts.length)];
    }

    // SCENARIO G: Omitting Known Yellow Letter (Blunder)
    if (analysis.yellowOmitted.length > 0) {
        const omit = analysis.yellowOmitted[0];
        const yellowOmitRoasts = [
            `Row ${omit.row - 1} told you "${omit.letter}" is in the word. So why did you guess a word without it on row ${omit.row}?`,
            `Completely forgetting about the yellow "${omit.letter}" on row ${omit.row}? Bold strategy.`,
            `You left out "${omit.letter}" in row ${omit.row} even though it's a confirmed present letter.`,
            `Yellow "${omit.letter}" was right there waving at you, but you completely ignored it in row ${omit.row}.`,
            `Leaving out "${omit.letter}"? That letter is filing a missing persons report as we speak.`
        ];
        return yellowOmitRoasts[Math.floor(Math.random() * yellowOmitRoasts.length)];
    }

    // Fallback to baseline congratulatory or tier messages
    return baseMessage;
}
