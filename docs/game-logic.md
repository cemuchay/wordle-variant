# Game Logic Core

This directory contains the authoritative logic for the Wordle Variant gameplay, word generation, and scoring systems.

## Core Responsibilities

### 1. Word Generation (`getDailyConfig`)
Determines the target word for any given date.
- **Deterministic**: Uses a PRNG (Mulberry32) seeded with the date and a secret salt to ensure all players receive the same word.
- **Eras**: 
    - **Legacy (< 2026-05-03)**: Simple summation hash.
    - **Transition (< 2026-05-11)**: Switched to djb2-style hash for fewer collisions.
    - **Modern (Current)**: Supports variable lengths (3-7) with weighted distribution.
- **Collision Protection**: Checks the previous 14 days to ensure words don't repeat too quickly.

### 2. Scoring System (`calculateSkillIndex`)
Calculates the "Skill Index" based on player performance.
- **Active System (Starting 2026-07-06 — July 2026 Era)**:
    - **Per-row Points**: Row-dependent for correct (65→20) and present (50→10) letters.
    - **Absent Penalty**: -5 for new absent letters.
    - **Repeated Absent Penalty**: -20 for re-guessing a known absent letter.
    - **Regression Checks**: Green→Yellow (-5), Yellow same-spot (-5), Green→Black (-15), Yellow→Black (-10).
    - **Hint Penalty**: -100 points (when hintRecord.row is defined).
    - **Entity Tracking**: Points awarded only once per letter placement to prevent double-counting.
    - **Loss Protection**: Failing to solve the word sets the base score to 0.
- **Revamped System (2026-05-18 to 2026-07-05)**: Payoff + Deduction system with entity tracking.
- **Legacy System (< 2026-05-18)**: Retained for backwards compatibility.

### 3. Guess Validation (`checkGuess`)
Standard two-pass algorithm to accurately assign Green/Yellow/Black statuses while handling duplicate letters correctly.

### 4. Data Synchronization (`syncGameState`)
Handles the persistence of scores and game states to Supabase with built-in retry logic.

## Distribution Settings

To adjust the frequency of different word lengths, modify the weighted buckets in `getWordAtDate`:
- `3 Letters`: 5%
- `7 Letters`: 5%
- `4 Letters`: 15%
- `5 Letters`: 35%
- `6 Letters`: 30%

## Maintenance & Adjustments

- **Adding Statuses**: If you add a new `LetterStatus` (e.g., "invalid"), update the priority logic in `getLetterStatuses`.
- **Changing Difficulty**: To make the game harder, increase the `knownBlacks` penalty in `calculateSkillIndex` from `-20` to something higher.
- **Word Expiry**: The collision protection is set to 14 days. Increase this in `getDailyConfig` if the word pool is large enough to support it.

## Testing

Game logic tests live in `src/__tests__/game-logic/` and run via Vitest:

```bash
# Run all game-logic tests
npx vitest run src/__tests__/game-logic

# Run a specific test file
npx vitest run src/__tests__/game-logic/scoringJuly2026.test.ts
```

**8 test files covering current (July 2026+) paths only:**
- `checkGuess.test.ts` — checkGuess, getLetterStatuses
- `hints.test.ts` — isHintDisabled, getHint
- `crypto.test.ts` — obfuscate/deobfuscate, encrypt/decrypt
- `wordSelection.test.ts` — getWordAtDate (July 27+ rotation), getRandomWord, ISO week utils
- `shapeShifter.test.ts` — isGuessCompatible, getShapeShifterFeedbackAndWord
- `scoringJuly2026.test.ts` — calculateSkillIndexJuly2026
- `dailyConfig.test.ts` — getDailyConfig (current constraint path)
- `stats.test.ts` — updateStats
- `barrel.test.ts` — barrel export integrity
