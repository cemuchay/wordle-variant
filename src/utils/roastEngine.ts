/* eslint-disable @typescript-eslint/no-explicit-any */
import { type GuessResult } from "../types/game";
import { getWinMessage, getLossMessage } from "../lib/messages";

export interface RoastAnalysis {
   grayReuses: string[]; // letters that are not in the word but reused
   greenLosses: {
      letter: string;
      index: number;
      row: number;
      changedTo: string;
   }[];
   yellowRepeatedSpots: { letter: string; index: number; row: number }[];
   yellowOmitted: { letter: string; row: number }[];
   duplicateGuesses: string[];
   strategicDiscards: { row: number; newLettersCount: number }[];
}

const DEFAULT_ROAST_ANALYSIS: RoastAnalysis = Object.freeze({
   grayReuses: [],
   greenLosses: [],
   yellowRepeatedSpots: [],
   yellowOmitted: [],
   duplicateGuesses: [],
   strategicDiscards: [],
});

/**
 * Scans guesses row-by-row to detect logical mistakes, strategic burner rows,
 * and information violations revealed in previous rows.
 */
export function analyzeGame(
   guesses: GuessResult[][],
   targetWord: string,
): RoastAnalysis {
   try {
      if (!Array.isArray(guesses) || !targetWord) {
         return { ...DEFAULT_ROAST_ANALYSIS };
      }

      const targetLower = (targetWord || "").toLowerCase();
      const targetLetters = targetLower.split("");

      const grayReuses: string[] = [];
      const greenLosses: {
         letter: string;
         index: number;
         row: number;
         changedTo: string;
      }[] = [];
      const yellowRepeatedSpots: { letter: string; index: number; row: number }[] =
         [];
      const yellowOmitted: { letter: string; row: number }[] = [];
      const duplicateGuesses: string[] = [];
      const strategicDiscards: { row: number; newLettersCount: number }[] = [];

      // Reconstruct words guessed
      const guessedWords: string[] = guesses.map((g) =>
         Array.isArray(g)
            ? g.map((c) => (c?.letter || (c as any)?.char || "").toLowerCase()).join("")
            : "",
      );

      // Check duplicate words
      const seenWords = new Set<string>();
      guessedWords.forEach((w) => {
         if (!w) return;
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
         if (!Array.isArray(currentGuess)) continue;
         const currentWord = guessedWords[r] || "";

         // Check mistakes & strategic choices against accumulated knowledge
         if (r > 0) {
            let omittedGreenOrYellow = false;

            // 1. Check green losses
            for (const [idxStr, prevLetter] of Object.entries(greensAtRow)) {
               const idx = parseInt(idxStr, 10);
               const currentLetter = currentGuess[idx]?.letter?.toLowerCase();
               if (currentLetter && currentLetter !== prevLetter) {
                  omittedGreenOrYellow = true;
                  greenLosses.push({
                     letter: prevLetter.toUpperCase(),
                     index: idx,
                     row: r + 1,
                     changedTo: currentLetter.toUpperCase(),
                  });
               }
            }

            // 2. Check gray reuses
            let reusedGrayInThisRow = false;
            for (let i = 0; i < currentGuess.length; i++) {
               const char = (
                  currentGuess[i]?.letter ||
                  (currentGuess[i] as any)?.char ||
                  ""
               ).toLowerCase();
               if (char && graysDetected.has(char)) {
                  reusedGrayInThisRow = true;
                  if (!grayReuses.includes(char.toUpperCase())) {
                     grayReuses.push(char.toUpperCase());
                  }
               }
            }

            // 3. Check yellow violations & omissions
            const currentLettersInGuess = new Set(currentWord.split(""));
            for (const [yLetter, prevIndices] of Object.entries(yellowsAtRow)) {
               if (!currentLettersInGuess.has(yLetter)) {
                  omittedGreenOrYellow = true;
                  yellowOmitted.push({
                     letter: yLetter.toUpperCase(),
                     row: r + 1,
                  });
               } else {
                  for (let i = 0; i < currentGuess.length; i++) {
                     const char = (
                        currentGuess[i]?.letter ||
                        (currentGuess[i] as any)?.char ||
                        ""
                     ).toLowerCase();
                     if (char === yLetter && prevIndices.has(i)) {
                        yellowRepeatedSpots.push({
                           letter: yLetter.toUpperCase(),
                           index: i,
                           row: r + 1,
                        });
                     }
                  }
               }
            }

            // 4. Check for Strategic Discard (Burner Row)
            // A row is strategic if it omits known info BUT tests 4+ brand new letters with zero gray reuses!
            if (omittedGreenOrYellow && !reusedGrayInThisRow) {
               const rowLetters = currentWord.split("");
               let newLetterCount = 0;
               rowLetters.forEach((ch) => {
                  if (!allSeenLetters.has(ch)) {
                     newLetterCount++;
                  }
               });

               if (newLetterCount >= 4) {
                  strategicDiscards.push({
                     row: r + 1,
                     newLettersCount: newLetterCount,
                  });
               }
            }
         }

         // Update accumulated knowledge from current guess
         for (let i = 0; i < currentGuess.length; i++) {
            const charObj = currentGuess[i];
            if (!charObj) continue;
            const char = (
               charObj.letter ||
               (charObj as any).char ||
               ""
            ).toLowerCase();
            if (!char) continue;

            allSeenLetters.add(char);

            if (charObj.status === "correct") {
               greensAtRow[i] = char;
            } else if (charObj.status === "present") {
               if (!yellowsAtRow[char]) {
                  yellowsAtRow[char] = new Set<number>();
               }
               yellowsAtRow[char].add(i);
            } else if (charObj.status === "absent") {
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
         strategicDiscards,
      };
   } catch (error) {
      console.error("[roastEngine] Error during game analysis:", error);
      return { ...DEFAULT_ROAST_ANALYSIS };
   }
}

/**
 * Helper to count unique green/yellow letters revealed prior to a given row or state.
 */
function getKnownLettersCountUpTo(
   guesses: GuessResult[][],
   maxRow?: number,
): number {
   try {
      if (!Array.isArray(guesses)) return 0;
      const known = new Set<string>();
      const limit =
         maxRow !== undefined ? Math.min(guesses.length, maxRow) : guesses.length;
      for (let r = 0; r < limit; r++) {
         for (const res of guesses[r] || []) {
            if (res && (res.status === "correct" || res.status === "present")) {
               const char = (res.letter || (res as any)?.char || "").toLowerCase();
               if (char) known.add(char);
            }
         }
      }
      return known.size;
   } catch (error) {
      console.error("[roastEngine] Error calculating known letters count:", error);
      return 0;
   }
}

/**
 * Shuffles an array using the Fisher-Yates algorithm, splits it into two halves,
 * and randomly selects an element from:
 * - the 1st half if the current date (day of the month) is an odd number
 * - the 2nd half if the current date (day of the month) is an even number
 *
 * @param array - The list of messages to sample from.
 * @returns A selected message string, or empty string if array is empty.
 */
export function selectSmartRoast(array: string[]): string {
   try {
      if (!array || array.length === 0) return "";
      if (array.length === 1) return array[0];

      // Perform an efficient Fisher-Yates copy-shuffle
      const shuffled = [...array];
      for (let i = shuffled.length - 1; i > 0; i--) {
         const j = Math.floor(Math.random() * (i + 1));
         const temp = shuffled[i];
         shuffled[i] = shuffled[j];
         shuffled[j] = temp;
      }

      const halfIndex = Math.ceil(shuffled.length / 2);
      const isOddDay = new Date().getDate() % 2 !== 0;

      const pool = isOddDay
         ? shuffled.slice(0, halfIndex)
         : shuffled.slice(halfIndex);

      // Fallback to full shuffled array if for any edge case the half is empty (e.g. empty 2nd half)
      const targetPool = pool.length > 0 ? pool : shuffled;
      return targetPool[Math.floor(Math.random() * targetPool.length)];
   } catch (error) {
      console.error("[roastEngine] Error in selectSmartRoast:", error);
      return array?.[0] || "";
   }
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
   hintRecord?: { letter: string; index: number; row: number } | null,
): string {
   try {
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
            `You submitted "${dup}" twice. Your ancestors are in the background holding their foreheads.`,
         ];
         return selectSmartRoast(dupRoasts);
      }

      // SCENARIO B: Hint Usage (Mild vs. Brutal Paths)
      if (usedHint) {
         // hintRecord.row can be 1-based (row: 1) or 0-based (guesses.length)
         // Normalize: if hintRecord.row is 0, it means before guess 1 (row 1).
         // If hintRecord.row is > 0, it represents the row after which hint was taken.
         const rawRow = hintRecord?.row ?? Math.max(1, attempts - 2);
         const displayRow = rawRow <= 0 ? 1 : rawRow;
         const knownBeforeHint = getKnownLettersCountUpTo(guesses, rawRow);

         // Brutal path: Hint taken early (on or before row 2) OR when 3+ letters were already revealed on the board!
         const isBrutalHint = displayRow <= 2 || knownBeforeHint >= 3;

         if (isBrutalHint) {
            const brutalHintRoasts = [
               `You asked for a hint on row ${displayRow}? Omo, at least pretend to struggle first. 😭`,
               `You barely warmed up and already called for backup. Is everything okay at home?`,
               `A hint this early? You came to play varian twith absolutely no intention of doing variant.`,
               `You saw the puzzle and immediately started looking for the oga. 😂`,
               `Even the letters haven't finished introducing themselves and you're already asking for help.`,
               `You used a hint with ${knownBeforeHint} letters already revealed? My guy, what exactly are we doing here?`,
               `Omo, you didn't even give your brain a chance to load. Straight to the hint button.`,
               `You asked for help so early, even the answer is wondering what it did to deserve this.`,
               `Row ${displayRow} and you're already calling for reinforcements. This is not a group project, abeg.`,
               `You treat the hint button like it's part of the tutorial. Nobody told you to press everything you see!`,
               `You didn't come to solve the puzzle. You came to supervise the hint system.`,
               `Ah ah! At least greet the puzzle before asking it for assistance.`,
               `You pressed hint with ${knownBeforeHint} letters already showing. The game has started doing the work and you're still outsourcing.`,
               `Your brain said, "Let's figure this out." You said, "There's an easier way." And here we are.`,
               `You called for help like someone who opened a jar once and immediately summoned the whole family.`,
               `This early? Even your village people haven't finished setting up and you've surrendered.`,
               `The hint button must be your favourite feature. You two are getting suspiciously close.`,
               `You saw a challenge and immediately started negotiating the difficulty. Oga, play the game!`,
               `Not you requesting technical support before the problem has even loaded properly.`,
               `You asked for a hint so early, the puzzle hasn't even had time to disrespect you yet.`,
               `With ${knownBeforeHint} letters already revealed, you still needed backup? Please, let's keep this between us.`,
               `Your strategy is simple: encounter problem, panic, press hint. A bold approach to life.`,
               `You hit that hint button with the confidence of someone spending another person's data.`,
               `At this rate, we'll just send you the answer in a WhatsApp message tomorrow.`,
               `The puzzle said "your turn." You said "can somebody help me?" 😭`,
               `You outsourced the thinking before the thinking even started. CEO behaviour, honestly.`,
            ];
            return selectSmartRoast(brutalHintRoasts);
         } else {
            // Mild path: Hint taken late when genuinely stuck
            const mildHintRoasts = [
               `A win in ${attempts} attempts, with a little assistance. We'll allow it. 😂`,
               `You got there in ${attempts}, but let's not pretend that hint wasn't part of the team.`,
               `A win is a win. The hint can share the credit on LinkedIn.`,
               `You were close, got stuck, and called for help. Fair enough. Your secret is safe with us.`,
               `Congratulations! You solved it with a tiny contribution from the hint department.`,
               `You won, but the hint deserves an honourable mention in your victory speech.`,
               `That hint came in clutch. Sometimes you need a little help, even from a button.`,
               `You got the win in ${attempts}. Was it all you? No. Are we counting it? Absolutely.`,
               `The hint helped, but you still had to finish the job. Teamwork makes the dream work.`,
               `You and that hint pulled through together. A beautiful partnership, really.`,
               `You struggled a little, asked for help, and got the job done. Very adult of you.`,
               `A little hint never hurt anybody. Your ego might need a few minutes, though.`,
               `You made it! Let's just say the hint was your unpaid intern.`,
               `You got the answer in ${attempts}. The hint gave you directions; you still had to drive.`,
               `That was a close one. Good thing the hint button picked up your call.`,
               `You didn't give up, and that's what matters. Even if you did ask a certain little button for help.`,
               `Win secured! We'll only put a tiny asterisk beside this one. A very tiny one.`,
               `You found the answer with a little nudge. No shame in that, champion.`,
               `The hint did some heavy lifting, but you still brought the result home. Respect.`,
               `You survived! The hint is already telling everyone it made the win`,
               `You got it in ${attempts}. Your brain and the hint system have agreed to share custody of this win.`,
               `A win with assistance is still a win. Don't let anybody intimidate you. Especially us.`,
               `You needed a little help, but you finished strong. We shall not discuss the details at this time.`,
               `That hint was clutch. Please remember to thank it in your post match interview.`,
               `You got the W. The hint wants its flowers, but we'll let you have the spotlight.`,
               `You were stuck, you got help, and you figured it out. That's better than staring at the screen till tomorrow.`,
               `The hint whispered in your ear and you finally understood. We love a supportive friendship.`,
               `You made it across the finish line. The hint was in the passenger seat yelling directions.`,
               `You won in ${attempts}. Let's call it assisted intelligence and move on with our lives.`,
               `Not your cleanest win, but a win nonetheless. Three cheers for asking for help when you needed it!`,
            ];
            return selectSmartRoast(mildHintRoasts);
         }
      }

      // SCENARIO C: Strategic Discard (Burner Row testing 4+ fresh letters)
      if (analysis.strategicDiscards.length > 0 && won) {
         const burner = analysis.strategicDiscards[0];

         const strategicRoasts = [
            `You sacrificed a perfectly good guess on row ${burner.row} just to meet new letters. Oga, who sent you? 😂`,
            `Row ${burner.row} was used for research purposes. well done`,
            `You threw away confirmed letters to test ${burner.newLettersCount} new ones. Even scientists have budgets, my guy.`,
            `Ah, so you actually had a plan on row ${burner.row}? We thought you were just pressing buttons.`,
            `You used row ${burner.row} to gather intelligence. EFCC should investigate this level of calculation.`,
            `Sacrificing what you know to find out what you don't know. Omo, you came to play variant with a PhD thesis.`,
            `You burned a whole row just to test new letters. Risky business, but who are we to question the chairman?`,
            `Row ${burner.row}: one small sacrifice for you, one giant leap for your remaining brain cells.`,
            `You abandoned letters that were already working for you. This relationship with uncertainty needs to be studied.`,
            `You really said, "Forget what I know, let's find out what I don't." And somehow, it worked. 😭`,
            `Using a whole row for letter scouting? The rest of us are playing a word game. You're conducting a census.`,
            `You spent row ${burner.row} gathering evidence like a detective. Case closed, sha.`,
            `You gambled a perfectly good guess for more information. Please don't bring this same energy to your finances.`,
            `You sacrificed known letters for new ones and still won. Confidence level: person who says "I know a guy."`,
            `Row ${burner.row} was not wasted. It was an investment. Please see your financial adviser for further interpretation.`,
            `You used ${burner.newLettersCount} fresh letters on row ${burner.row}. Somebody give this person a research grant.`,
            `Not you abandoning useful information to go and look for more information. You must be fun to shop with.`,
            `You took the scenic route to the answer. Google Maps would have recalculated by now.`,
            `You burned a row for information and still pulled off the win. Okay, professor, we see you. 🫡`,
            `All that experimentation and you still won. We were ready to laugh at you, but now we have to respect you.`,
            `You know what? It looked like confusion at first, but since you won, let's call it strategy.`,
            `You sacrificed confirmed letters to test new ones. Risky move. Thankfully, this is variant and not a relationship.`,
            `Row ${burner.row} was your little science experiment. Results are in: somehow, you're not as clueless as you look.`,
            `You spent a whole guess collecting clues like the answer was hiding from you personally. At least you found it.`,
            `You could have played it safe, but no. You chose research, development, and unnecessary suspense. Respect.`,
         ];

         return selectSmartRoast(strategicRoasts);
      }

      // SCENARIO D: Green Letter Loss (Blunder / Self-Sabotage)
      if (analysis.greenLosses.length > 0) {
         const loss = analysis.greenLosses[0];

         const greenRoasts = [
            `The game literally told you "${loss.letter}" was correct, and you said "I no gree." 😭`,
            `You had "${loss.letter}" in green on row ${loss.row - 1}. Then you removed it. Oga, are you fighting the game?`,
            `So "${loss.letter}" was correct, but you replaced it with "${loss.changedTo}"? This is between you and your ancestors.`,
            `Row ${loss.row - 1} gave you the answer on a platter. Row ${loss.row} said, "Actually, let me make life difficult."`,
            `You threw away a green letter! Even the game is tired of explaining things to you.`,
            `You saw "${loss.letter}" sitting comfortably in the right spot and decided it needed to leave. Who hurt you?`,
            `The clue was right there, staring at you. You still changed "${loss.letter}" to "${loss.changedTo}". I'm not even angry, just disappointed.`,
            `You changed a confirmed letter to "${loss.changedTo}"? That's not a guess, that's a personal vendetta.`,
            `Green means correct, my friend. It doesn't mean "try something else and see what happens."`,
            `You had insider information and still chose to be an outsider. Incredible scenes.`,
            `Imagine getting the answer key and deciding to freestyle anyway. That's exactly what you did with "${loss.letter}".`,
            `You removed "${loss.letter}" from its rightful home. Even tenants have more security than this letter.`,
            `Row ${loss.row - 1}: "${loss.letter}" is correct. Row ${loss.row}: "Let's pretend I never saw that." Omo!`,
            `You had one job: keep the green letter green. Somehow, we are here.`,
            `You replaced "${loss.letter}" with "${loss.changedTo}" at position ${loss.index + 1}. My bro/sis in variant, WHY? 😂`,
            `The game gave you a clue, not a suggestion. Why are you negotiating with facts?`,
            `You discarded a green letter like it owed you money. Please explain yourself.`,
            `That "${loss.letter}" was minding its business in the correct spot. You came and evicted it. For what?`,
            `You know what? Maybe "${loss.letter}" needed a break. Because clearly, you weren't appreciating it.`,
            `You saw a green light and still took a different road. Even Google Maps can't help you here.`,
            `You went from knowing something to knowing nothing. Character development, I suppose.`,
            `You changed "${loss.letter}" to "${loss.changedTo}" after the game confirmed it. This is how people lose good things in life.`,
            `At this point, the letters need a support group. Imagine working hard to turn green just to get replaced.`,
            `You really looked at a correct answer and said, "Let's not get carried away." 😭`,
            `The game is giving you free information and you're actively declining the offer. In this economy!`,
            `You had the right letter in the right spot. Then you woke up and chose violence.`,
            `If "${loss.letter}" could talk, it would have asked for a transfer to another player's board.`,
            `You replaced a confirmed letter with a mystery. Even Nigerian politicians don't abandon evidence this quickly.`,
            `Row ${loss.row - 1} did the hard work. Row ${loss.row} came in and scattered everywhere. Teamwork has failed.`,
            `Not you breaking up with a letter that was clearly right for you. We need to talk about your decision-making.`,
         ];

         return selectSmartRoast(greenRoasts);
      }

      // SCENARIO E: Reusing Dead Gray Letters
      if (analysis.grayReuses.length > 0) {
         const letters = analysis.grayReuses.slice(0, 2).join(", ");
         const grayRoasts = [
            `Reusing gray letters ("${letters}")? Are you allergic to the process of elimination?`,
            `Guessed dead letters like "${letters}" again? Stop guessing letters that are already marked gray!`,
            `Those gray tiles aren't just for decoration. Why did you reuse "${letters}"?`,
            `You saw "${letters}" turn gray and said "let me try it again, maybe it changed its mind."`,
            `Reusing gray letter "${letters}"? That's like calling your ex after they blocked you everywhere.`,
            `Gray means DEAD. OWO. Why are you exhuming "${letters}" on row ${analysis.grayReuses.length}?`,
            `You used "${letters}" again? Brother/Sister, gray is not a color option, it's an eviction notice.`,
            `Reusing "${letters}"? Your strategy is "vibes and selective amnesia."`,
         ];
         return selectSmartRoast(grayRoasts);
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
            `You put "${repeat.letter}" in spot ${repeat.index + 1} again like you were arguing with the server.`,
         ];
         return selectSmartRoast(yellowRepeatRoasts);
      }

      // SCENARIO G: Omitting Known Yellow Letter (Blunder)
      if (analysis.yellowOmitted.length > 0) {
         const omit = analysis.yellowOmitted[0];
         const yellowOmitRoasts = [
            `Row ${omit.row - 1} told you "${omit.letter}" is in the word. So why did you guess a word without it on row ${omit.row}?`,
            `Completely forgetting about the yellow "${omit.letter}" on row ${omit.row}? Bold strategy.`,
            `You left out "${omit.letter}" in row ${omit.row} even though it's a confirmed present letter.`,
            `Yellow "${omit.letter}" was right there waving at you, but you completely ignored it in row ${omit.row}.`,
            `Leaving out "${omit.letter}"? That letter is filing a missing persons report as we speak.`,
         ];
         return selectSmartRoast(yellowOmitRoasts);
      }

      // Fallback to baseline congratulatory or tier messages
      return baseMessage;
   } catch (error) {
      console.error("[roastEngine] Error generating roast:", error);
      try {
         return won ? getWinMessage(attempts) : getLossMessage();
      } catch {
         return won ? "Well played!" : "Better luck next time.";
      }
   }
}
