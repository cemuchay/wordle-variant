import { describe, it, expect, vi } from "vitest";
import {
   pickHandicapStarter,
   filterRemainingPool,
   generateHandicapStarters,
} from "../../hooks/queries/sub-queries/helpers/handicapStarters";
import getMatchCount from "../../hooks/queries/sub-queries/helpers/getMatchCount";

vi.mock("@/data/words", () => ({
   loadWordLists: vi.fn(async (length: number) => {
      const words: Record<number, string[]> = {
         3: ["CAT", "TEA", "DOG", "BAT", "RAT", "OAT", "ERA", "TAN", "RED", "SEA"],
         4: ["WORD", "SOAR", "ROSE", "LATE", "TORE", "TARE", "EAST", "BEAR", "WIND", "RANT"],
         5: [
            "CRANE", "SLATE", "TRACE", "ROAST", "AUDIO", "ADIEU", "SALET", "PLANT",
            "FUZZY", "XYLYL", "JUMBO", "QUIRK", "GLYPH", "BRICK", "VIXEN", "ZEBRA",
            "CRAFT", "TRACK", "TRASH", "TRAIN", "LIGHT", "HELLO", "QUERY", "WORDS",
         ],
      };
      return {
         official: words[length] || ["CRANE"],
         valid: new Set(words[length] || ["CRANE"]),
      };
   }),
}));

describe("handicapStarters logic", () => {
   const samplePool = [
      "CRANE",
      "SLATE",
      "TRACE",
      "ROAST",
      "AUDIO",
      "ADIEU",
      "SALET",
      "PLANT",
      "FUZZY",
      "XYLYL",
      "JUMBO",
      "QUIRK",
      "GLYPH",
      "BRICK",
      "VIXEN",
      "ZEBRA",
      "CRAFT",
      "TRACK",
      "TRASH",
      "TRAIN",
   ];

   it("filterRemainingPool correctly removes words violating guess feedback", () => {
      const target = "CRANE";
      // Guess "TRACE": T=yellow, R=green, A=green, C=yellow, E=green
      const filtered = filterRemainingPool(samplePool, "TRACE", target);
      expect(filtered).toContain("CRANE");
      expect(filtered).not.toContain("AUDIO");
      expect(filtered).not.toContain("FUZZY");
   });

   it("Easy handicap mode chooses a high-value starter that does not reveal target and leaves candidates", async () => {
      const target = "CRANE";
      const starter = await pickHandicapStarter({
         target,
         length: 5,
         level: "easy",
         candidatePool: samplePool,
      });

      expect(starter).not.toBe(target);
      expect(samplePool).toContain(starter);

      // Remaining pool after starter shouldn't be empty
      const remaining = filterRemainingPool(samplePool, starter, target);
      expect(remaining.length).toBeGreaterThanOrEqual(1);
      expect(remaining).toContain(target);
   });

   it("Difficult handicap mode chooses an unhelpful starter with minimal matches", async () => {
      const target = "CRANE";
      const starter = await pickHandicapStarter({
         target,
         length: 5,
         level: "difficult",
         candidatePool: samplePool,
      });

      expect(starter).not.toBe(target);
      expect(samplePool).toContain(starter);

      // Difficult starter should have minimal matches with CRANE
      const matchCount = getMatchCount(starter, target);
      expect(matchCount).toBeLessThanOrEqual(2);
   });

   it("Normal handicap mode satisfies standard match bounds", async () => {
      const target = "CRANE";
      const starter = await pickHandicapStarter({
         target,
         length: 5,
         level: "normal",
         candidatePool: samplePool,
      });

      expect(starter).not.toBe(target);
      expect(getMatchCount(starter, target)).toBeLessThanOrEqual(3);
   });

   it("generateHandicapStarters generates 1 row for single game by default", async () => {
      const result = await generateHandicapStarters({
         targetWord: "CRANE",
         length: 5,
         handicapLevel: "easy",
         handicapRows: 1,
      });

      expect(typeof result.finalHandicapStarter).toBe("string");
      expect(result.finalHandicapStarter).not.toBe("CRANE");
      expect(result.finalHandicapStarters).toBeNull();
   });

   it("generateHandicapStarters generates 2 rows for single game when handicapRows is 2", async () => {
      const result = await generateHandicapStarters({
         targetWord: "CRANE",
         length: 5,
         handicapLevel: "easy",
         handicapRows: 2,
      });

      expect(Array.isArray(result.finalHandicapStarter)).toBe(true);
      const starters = result.finalHandicapStarter as string[];
      expect(starters).toHaveLength(2);
      expect(starters[0]).not.toBe("CRANE");
      expect(starters[1]).not.toBe("CRANE");
      expect(starters[0]).not.toBe(starters[1]);
      expect(result.finalHandicapStarters).toBeNull();
   });

   it("generateHandicapStarters generates marathon starters with 1 or 2 rows", async () => {
      const marathon1Row = await generateHandicapStarters({
         length: 1,
         marathonGames: [3, 4, 5],
         plainMarathonTargets: { 0: "CAT", 1: "WORD", 2: "CRANE" },
         handicapLevel: "normal",
         handicapRows: 1,
      });

      expect(Array.isArray(marathon1Row.finalHandicapStarters)).toBe(true);
      expect(marathon1Row.finalHandicapStarters).toHaveLength(3);
      expect(typeof marathon1Row.finalHandicapStarters![0]).toBe("string");

      const marathon2Rows = await generateHandicapStarters({
         length: 1,
         marathonGames: [3, 4, 5],
         plainMarathonTargets: { 0: "CAT", 1: "WORD", 2: "CRANE" },
         handicapLevel: "easy",
         handicapRows: 2,
      });

      expect(Array.isArray(marathon2Rows.finalHandicapStarters)).toBe(true);
      expect(marathon2Rows.finalHandicapStarters).toHaveLength(3);
      expect(Array.isArray(marathon2Rows.finalHandicapStarters![0])).toBe(true);
      expect(marathon2Rows.finalHandicapStarters![0]).toHaveLength(2);
   });
});
