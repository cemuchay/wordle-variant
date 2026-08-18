import { describe, it, expect } from "vitest";
import {
   findOptimalBotMove,
   simulateBotGame,
} from "../components/guess-preview/logic/gameAnalysisLogic";

describe("Bot Analysis Algorithm - Discarded Letter Elimination Rules", () => {
   it("never plays discarded absent letters in subsequent moves", () => {
      const poolBefore = ["CATCH", "HATCH", "MATCH", "PATCH", "WATCH"];
      const allowedWords = ["CHAMP", "TRAMP", "POUCH", "WOMAN", "BINGO", "STAMP"];
      const knownAbsent = new Set(["M", "P"]); // Suppose user/bot already discovered M and P are absent

      const botMove = findOptimalBotMove(
         poolBefore,
         allowedWords,
         5,
         2,
         knownAbsent,
      );

      // Bot move must NOT contain 'M' or 'P'
      expect(botMove.word).toBeDefined();
      expect(botMove.word.includes("M")).toBe(false);
      expect(botMove.word.includes("P")).toBe(false);
   });

   it("runs full simulation without repeating any discarded absent letters", async () => {
      const sim = await simulateBotGame("CRANE", "LIGHT");
      expect(sim.botLineWords.length).toBeGreaterThanOrEqual(1);

      const knownAbsent = new Set<string>();
      for (let i = 0; i < sim.guesses.length; i++) {
         const row = sim.guesses[i];
         const word = sim.botLineWords[i];

         // If i > 0, the word played must NOT contain any letters already known to be absent
         if (i > 0) {
            for (const ch of word) {
               expect(knownAbsent.has(ch)).toBe(false);
            }
         }

         // Update knownAbsent
         row.forEach((cell: any) => {
            if (cell.status === "absent") {
               const char = cell.letter.toUpperCase();
               const isPresentOrCorrect = sim.guesses.some((r: any) =>
                  r.some(
                     (c: any) =>
                        c.letter.toUpperCase() === char &&
                        c.status !== "absent",
                  ),
               );
               if (!isPresentOrCorrect) knownAbsent.add(char);
            }
         });
      }
   });
});
