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
- **Active System (Starting 2026-05-18)**:
    - **Discovery Bonuses**: +40 for Green discovery, +25 for Yellow discovery (one-off per placement).
    - **Strategic Penalties**: -5 for new black letters, -20 for repeating a known black letter.
    - **Hint Penalty**: -100 points.
    - **Loss Protection**: Failing to solve the word sets the base score to 0.
- **Legacy System**: Retained for backwards compatibility with games played before May 18th.

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

Run the scoring test suite using `tsx`:
```bash
npx tsx src/lib/game-logic/skillIndex.test.ts
```
*(Note: Ensure execution policies allow script running if on Windows)*
