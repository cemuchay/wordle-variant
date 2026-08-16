import { describe, it, expect, vi } from "vitest";
import { GAME_LOGIC_VERSION, ALGORITHM_SIGNATURES } from "../../constants/version";
import { getDailyConfig } from "../../lib/game-logic";

vi.mock("../../data/words", () => ({
   loadWordLists: vi.fn(async (length: number) => {
      const mockDict: Record<number, string[]> = {
         3: ["CAT", "DOG", "SUN", "HAT", "BAT"],
         4: ["BOOK", "TEAM", "FREE", "DENY", "RAGE"],
         5: ["TRACE", "LIGHT", "HELLO", "SCUBA", "STANK"],
         6: ["PESTER", "ESCROW", "WIGGLE", "ASSERT", "FRIEND"],
         7: ["VISITOR", "DRUNKEN", "DIAPERS", "PENDING", "ELEMENT"],
      };
      return {
         official: mockDict[length] || ["WORD"],
         valid: new Set(mockDict[length] || ["WORD"]),
      };
   }),
}));

vi.mock("../../data/easy-words", () => ({
   getEasyWords: vi.fn(() => []),
}));

// Simple deterministic hash function for strings
function simpleHash(str: string): string {
   let hash = 0;
   for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0; // Convert to 32bit integer
   }
   return Math.abs(hash).toString(16);
}

describe("Game Logic Versioning & Algorithm Change Enforcement", () => {
   it("ensures ALGORITHM_SIGNATURES version matches current GAME_LOGIC_VERSION", () => {
      expect(
         ALGORITHM_SIGNATURES.version,
         `Mismatch! ALGORITHM_SIGNATURES.version (${ALGORITHM_SIGNATURES.version}) does not match GAME_LOGIC_VERSION (${GAME_LOGIC_VERSION}). When algorithm changes occur, bump both in src/constants/version.ts.`
      ).toBe(GAME_LOGIC_VERSION);
   });

   it("fails if Word of the Day algorithm output changes without bumping GAME_LOGIC_VERSION", async () => {
      // Sample reference dates
      const referenceDates = [
         "2026-08-01",
         "2026-08-02",
         "2026-08-03",
         "2026-08-04",
         "2026-08-05",
         "2026-08-06",
         "2026-08-07",
      ];

      const authResults = await Promise.all(
         referenceDates.map((d) => getDailyConfig(true, d))
      );
      const guestResults = await Promise.all(
         referenceDates.map((d) => getDailyConfig(false, d))
      );

      const serializedOutputs = JSON.stringify({
         auth: authResults.map((r) => `${r.word}_${r.length}_${r.maxAttempts}`),
         guest: guestResults.map((r) => `${r.word}_${r.length}_${r.maxAttempts}`),
      });

      const currentHash = simpleHash(serializedOutputs);
      const currentComputedSignature = `WOD_2026_08_V${GAME_LOGIC_VERSION}_${currentHash}`;

      if (currentComputedSignature !== ALGORITHM_SIGNATURES.wordOfDaySignature) {
         // If version was NOT bumped, fail with explicit instructions
         if (ALGORITHM_SIGNATURES.version === GAME_LOGIC_VERSION) {
            throw new Error(
               `\n\n` +
               `--------------------------------------------------------------------------------\n` +
               `🛑 CRITICAL ERROR: WORD OF THE DAY ALGORITHM OUTPUT HAS CHANGED!\n` +
               `--------------------------------------------------------------------------------\n` +
               `The generated words or lengths for reference dates have changed.\n` +
               `You MUST bump GAME_LOGIC_VERSION in 'src/constants/version.ts' when modifying game logic.\n\n` +
               `Current Output Signature Hash: "${currentComputedSignature}"\n` +
               `Expected Signature Hash:       "${ALGORITHM_SIGNATURES.wordOfDaySignature}"\n\n` +
               `To resolve this test failure:\n` +
               `1. Increment GAME_LOGIC_VERSION in 'src/constants/version.ts' (e.g. "${GAME_LOGIC_VERSION}" -> "1.6.0").\n` +
               `2. Update ALGORITHM_SIGNATURES in 'src/constants/version.ts':\n` +
               `   version: "1.6.0",\n` +
               `   wordOfDaySignature: "${currentComputedSignature}"\n` +
               `--------------------------------------------------------------------------------\n`
            );
         }
      }

      expect(currentComputedSignature).toBe(ALGORITHM_SIGNATURES.wordOfDaySignature);
   });
});
