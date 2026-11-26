import { describe, it, expect, beforeEach, vi } from "vitest";
import {
   OTDB_CATEGORIES,
   buildOtdbUrl,
   classifyScience,
   decodeOtdb,
   difficultyToInt,
   fisherYatesShuffle,
   normalizeOtdbResult,
   otdbCategoryForTopic,
} from "../wordup/shared/otdbCore";
import {
   CLIENT_CURATION_COOLDOWN_MS,
   CLIENT_CURATION_KEY,
   isClientCurationDue,
   maybeCurateWordUpTrivia,
} from "../wordup/shared/otdbClientCurator";
import {
   MAX_RECENT_EIDS,
   MAX_RECENT_PROMPTS,
   MAX_RECENT_QIDS,
   RECENT_EIDS_PREFIX,
   RECENT_PROMPTS_PREFIX,
   RECENT_QIDS_PREFIX,
   addRecentEntityIds,
   addRecentPrompts,
   addRecentQuestionIds,
   extractEntityIds,
   extractPromptKeys,
   extractQuestionIds,
   getRecentEntityIds,
   getRecentPrompts,
   getRecentQuestionIds,
   normalizePromptKey,
} from "../wordup/shared/recentQuestions";

const makeUuid = (n: number) =>
   `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("otdbCore — Open Trivia DB normalization & shuffling", () => {
   it("decodes url3986 encoded strings cleanly without leftover HTML entities", () => {
      const encoded = encodeURIComponent('Who won the 2019 Men’s "Copa América" under José?');
      expect(decodeOtdb(encoded)).toBe('Who won the 2019 Men’s "Copa América" under José?');
      expect(decodeOtdb("  trimmed  ")).toBe("trimmed");
   });

   it("builds OpenTDB API URL with encode=url3986", () => {
      const url = buildOtdbUrl(18, 25);
      expect(url).toContain("category=18");
      expect(url).toContain("amount=25");
      expect(url).toContain("encode=url3986");
   });

   it("classifies Science & Nature prompts into chemistry, biology, and physics", () => {
      expect(classifyScience("What is the atomic number of Carbon element?")).toBe("chemistry");
      expect(classifyScience("Which organelle in a cell contains DNA?")).toBe("biology");
      expect(classifyScience("What is the speed of light in a vacuum?")).toBe("physics");
   });

   it("maps WordUp topic slugs to OpenTDB categories", () => {
      expect(otdbCategoryForTopic("computers")?.id).toBe(18);
      expect(otdbCategoryForTopic("physics")?.id).toBe(17);
      expect(otdbCategoryForTopic("chemistry")?.id).toBe(17);
      expect(otdbCategoryForTopic("unknown_topic")).toBeNull();
      expect(OTDB_CATEGORIES.length).toBeGreaterThanOrEqual(10);
   });

   it("maps OpenTDB difficulty strings to 1/3/5 integers", () => {
      expect(difficultyToInt("easy")).toBe(1);
      expect(difficultyToInt("medium")).toBe(3);
      expect(difficultyToInt("hard")).toBe(5);
   });

   it("distributes the correct answer uniformly across all 4 choice slots via Fisher-Yates", () => {
      const cat = otdbCategoryForTopic("computers")!;
      const raw = {
         question: encodeURIComponent("What does HTTP stand for?"),
         correct_answer: encodeURIComponent("HyperText Transfer Protocol"),
         incorrect_answers: [
            encodeURIComponent("High Transmission Text Process"),
            encodeURIComponent("Hyperlink Transport Terminal Protocol"),
            encodeURIComponent("Host Transfer Text Protocol"),
         ],
         difficulty: "easy",
      };

      const slotCounts = [0, 0, 0, 0];
      const runs = 1200;
      for (let i = 0; i < runs; i++) {
         const normalized = normalizeOtdbResult(raw, cat);
         expect(normalized).not.toBeNull();
         expect(normalized!.choices).toHaveLength(4);
         const idx = normalized!.choices.indexOf(normalized!.answer);
         expect(idx).toBeGreaterThanOrEqual(0);
         slotCounts[idx]++;
      }

      // Expected ~300 per slot; verify each slot gets at least 200 (not stuck at index 0)
      for (const count of slotCounts) {
         expect(count).toBeGreaterThan(200);
         expect(count).toBeLessThan(400);
      }
   });

   it("fisherYatesShuffle preserves all items without mutating input", () => {
      const orig = ["A", "B", "C", "D"];
      const shuffled = fisherYatesShuffle(orig);
      expect(orig).toEqual(["A", "B", "C", "D"]);
      expect(shuffled.sort()).toEqual(["A", "B", "C", "D"]);
   });
});

describe("recentQuestions — client ring buffer for anti-repetition", () => {
   beforeEach(() => {
      localStorage.clear();
   });

   it("stores unique UUIDs newest-first and caps at MAX_RECENT_QIDS", () => {
      const batch1 = Array.from({ length: 25 }, (_, i) => makeUuid(i + 1));
      const batch2 = Array.from({ length: 25 }, (_, i) => makeUuid(i + 21)); // 5 overlap
      addRecentQuestionIds("computers", batch1);
      const after = addRecentQuestionIds("computers", batch2);

      expect(after).toHaveLength(MAX_RECENT_QIDS);
      expect(after[0]).toBe(makeUuid(21));
      expect(new Set(after).size).toBe(MAX_RECENT_QIDS);
      expect(getRecentQuestionIds("computers")).toEqual(after);
      expect(localStorage.getItem(`${RECENT_QIDS_PREFIX}computers`)).not.toBeNull();
   });

   it("extractQuestionIds filters out non-UUID ids safely", () => {
      const u1 = makeUuid(1);
      const u2 = makeUuid(2);
      const extracted = extractQuestionIds([
         { id: u1 },
         { id: "not-a-uuid" },
         { id: undefined },
         { id: u2 },
      ]);
      expect(extracted).toEqual([u1, u2]);
   });

   it("stores unique entity UUIDs newest-first and caps at MAX_RECENT_EIDS", () => {
      const batch1 = Array.from({ length: 25 }, (_, i) => makeUuid(i + 1));
      const batch2 = Array.from({ length: 25 }, (_, i) => makeUuid(i + 21));
      addRecentEntityIds("geography", batch1);
      const after = addRecentEntityIds("geography", batch2);

      expect(after).toHaveLength(MAX_RECENT_EIDS);
      expect(after[0]).toBe(makeUuid(21));
      expect(getRecentEntityIds("geography")).toEqual(after);
      expect(localStorage.getItem(`${RECENT_EIDS_PREFIX}geography`)).not.toBeNull();
      expect(extractEntityIds([{ entityId: makeUuid(5) }, { entityId: "bad" }])).toEqual([makeUuid(5)]);
   });

   it("normalizes and stores prompt keys newest-first capped at MAX_RECENT_PROMPTS", () => {
      expect(normalizePromptKey("  What   is   HTTP? ")).toBe("what is http?");
      expect(normalizePromptKey("   ")).toBeNull();

      const batch1 = Array.from({ length: 25 }, (_, i) => `Prompt ${i + 1}`);
      const batch2 = Array.from({ length: 25 }, (_, i) => `  prompt   ${i + 21} `);
      addRecentPrompts("computers", batch1);
      const after = addRecentPrompts("computers", batch2);

      expect(after).toHaveLength(MAX_RECENT_PROMPTS);
      expect(after[0]).toBe("prompt 21");
      expect(getRecentPrompts("computers")).toEqual(after);
      expect(localStorage.getItem(`${RECENT_PROMPTS_PREFIX}computers`)).not.toBeNull();
      expect(extractPromptKeys([{ prompt: "  Hello   World " }, { prompt: "" }])).toEqual(["hello world"]);
   });
});

describe("otdbClientCurator — browser throttling & graceful failure", () => {
   beforeEach(() => {
      localStorage.clear();
      vi.restoreAllMocks();
   });

   it("respects the 6-hour cooldown window", () => {
      const now = 1_700_000_000_000;
      expect(isClientCurationDue(now)).toBe(true);
      localStorage.setItem(CLIENT_CURATION_KEY, String(now));
      expect(isClientCurationDue(now + 1000)).toBe(false);
      expect(isClientCurationDue(now + CLIENT_CURATION_COOLDOWN_MS - 1)).toBe(false);
      expect(isClientCurationDue(now + CLIENT_CURATION_COOLDOWN_MS)).toBe(true);
   });

   it("skips silently and returns 0 when already within cooldown", async () => {
      localStorage.setItem(CLIENT_CURATION_KEY, String(Date.now()));
      const fetchSpy = vi.spyOn(globalThis, "fetch");
      const inserted = await maybeCurateWordUpTrivia("computers");
      expect(inserted).toBe(0);
      expect(fetchSpy).not.toHaveBeenCalled();
   });
});

describe("tiered question selection — anti-repetition & LRU recycling", () => {
   interface Candidate {
      id: string;
      difficulty: number;
      seenCount: number;
      seenStatus: "none" | "some" | "all";
      lastSeenAt: number;
      difficultyProximity: number;
      clientExcluded?: boolean;
      clientExcludeOrder?: number;
   }

   // Mirrors the 4-tier band-shuffle algorithm in generate-match-questions/index.ts
   function rankCandidates(
      candidates: Candidate[],
      rand: () => number = Math.random,
   ): Candidate[] {
      const HOUR_MS = 3_600_000;
      const bandShuffle = (items: Candidate[], bandOf: (q: Candidate) => number) => {
         const bands = new Map<number, Candidate[]>();
         for (const q of items) {
            const b = bandOf(q);
            if (!bands.has(b)) bands.set(b, []);
            bands.get(b)!.push(q);
         }
         return [...bands.keys()]
            .sort((a, b) => a - b)
            .flatMap((b) => fisherYatesShuffle(bands.get(b)!, rand));
      };

      const unseen = candidates.filter((q) => !q.clientExcluded && q.seenStatus === "none");
      const seenSome = candidates.filter((q) => !q.clientExcluded && q.seenStatus === "some");
      const seenAll = candidates.filter((q) => !q.clientExcluded && q.seenStatus === "all");
      const excludedRecent = candidates
         .filter((q) => q.clientExcluded)
         .sort((a, b) => (b.clientExcludeOrder ?? 0) - (a.clientExcludeOrder ?? 0));

      return [
         ...bandShuffle(unseen, (q) => (q.difficultyProximity <= 1 ? 0 : q.difficultyProximity)),
         ...bandShuffle(seenSome, (q) => Math.floor(q.lastSeenAt / HOUR_MS)),
         ...bandShuffle(seenAll, (q) => Math.floor(q.lastSeenAt / HOUR_MS)),
         ...excludedRecent,
      ];
   }

   it("produces zero repeats across 3 consecutive 7-round solo/bot matches when pool >= 21", () => {
      const pool = Array.from({ length: 24 }, (_, i) => ({
         id: makeUuid(i + 1),
         difficulty: 3,
         difficultyProximity: 0,
      }));
      const seenAt = new Map<string, number>();
      const matches: string[][] = [];

      for (let m = 0; m < 3; m++) {
         const candidates: Candidate[] = pool.map((q) => ({
            ...q,
            seenCount: seenAt.has(q.id) ? 1 : 0,
            seenStatus: seenAt.has(q.id) ? "all" : "none",
            lastSeenAt: seenAt.get(q.id) ?? 0,
         }));
         const picked = rankCandidates(candidates).slice(0, 7).map((q) => q.id);
         matches.push(picked);
         const ts = Date.now() + m * 60_000;
         for (const id of picked) seenAt.set(id, ts);
      }

      const allPicked = matches.flat();
      expect(allPicked).toHaveLength(21);
      expect(new Set(allPicked).size).toBe(21);
   });

   it("recycles oldest-seen (LRU) questions before recently played ones when pool is exhausted", () => {
      const now = Date.now();
      const DAY = 86_400_000;
      const candidates: Candidate[] = [
         { id: "recent-1", difficulty: 3, seenCount: 1, seenStatus: "all", lastSeenAt: now - 1000, difficultyProximity: 0 },
         { id: "old-1", difficulty: 3, seenCount: 1, seenStatus: "all", lastSeenAt: now - 10 * DAY, difficultyProximity: 0 },
         { id: "mid-1", difficulty: 3, seenCount: 1, seenStatus: "all", lastSeenAt: now - 3 * DAY, difficultyProximity: 0 },
         { id: "unseen-1", difficulty: 3, seenCount: 0, seenStatus: "none", lastSeenAt: 0, difficultyProximity: 0 },
      ];

      const ordered = rankCandidates(candidates).map((c) => c.id);
      expect(ordered).toEqual(["unseen-1", "old-1", "mid-1", "recent-1"]);
   });

   it("places clientExcluded questions strictly after same-day seenAll questions, ordered least-recently-played first", () => {
      const now = Date.now();
      const HOUR = 3_600_000;
      const candidates: Candidate[] = [
         {
            id: "just-played",
            difficulty: 3,
            seenCount: 1,
            seenStatus: "all",
            lastSeenAt: now,
            difficultyProximity: 0,
            clientExcluded: true,
            clientExcludeOrder: 0,
         },
         {
            id: "played-two-games-ago",
            difficulty: 3,
            seenCount: 1,
            seenStatus: "all",
            lastSeenAt: now,
            difficultyProximity: 0,
            clientExcluded: true,
            clientExcludeOrder: 5,
         },
         {
            id: "same-day-not-excluded",
            difficulty: 3,
            seenCount: 1,
            seenStatus: "all",
            lastSeenAt: now - 2 * HOUR,
            difficultyProximity: 0,
            clientExcluded: false,
         },
      ];

      const ordered = rankCandidates(candidates).map((c) => c.id);
      expect(ordered).toEqual(["same-day-not-excluded", "played-two-games-ago", "just-played"]);
   });
});
