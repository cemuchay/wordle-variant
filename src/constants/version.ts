/**
 * Current version of the game logic and Word of the Day algorithm.
 * MUST be incremented whenever Word of the Day generation, scoring formulas, or word lists change.
 */
export const GAME_LOGIC_VERSION = "1.5.0";

/**
 * Deterministic signatures of algorithm outputs.
 * Enforced by `src/__tests__/game-logic/versionEnforcement.test.ts`.
 *
 * IF ALGORITHM OUTPUT CHANGES:
 * 1. Increment `GAME_LOGIC_VERSION` above (e.g. "1.5.0" -> "1.6.0").
 * 2. Update `version` and the signature hashes below to match the new outputs.
 */
export const ALGORITHM_SIGNATURES = {
   version: "1.5.0",
   wordOfDaySignature: "WOD_2026_08_V1.5.0_53386819",
   scoringSignature: "SCORE_V1.5.0_b841e96a",
};
