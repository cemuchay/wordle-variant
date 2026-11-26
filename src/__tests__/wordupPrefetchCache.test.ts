import { describe, it, expect, beforeEach, vi } from "vitest";
import {
   PREFETCH_CACHE_VERSION,
   cleanExpiredPrefetches,
   getPrefetchedBotMatch,
   prefetchBotMatchInBackground,
   resetPrefetchLocksForTesting,
   type PrefetchedBotMatch,
} from "../utils/wordupPrefetchCache";
import {
   addRecentEntityIds,
   addRecentPrompts,
   addRecentQuestionIds,
   getRecentEntityIds,
   getRecentPrompts,
   getRecentQuestionIds,
} from "../wordup/shared/recentQuestions";

const invokeMock = vi.fn();
const rpcMock = vi.fn();

vi.mock("../lib/supabaseClient", () => ({
   supabase: {
      auth: {
         getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      },
      functions: {
         invoke: (...args: unknown[]) => invokeMock(...args),
      },
      rpc: (...args: unknown[]) => rpcMock(...args),
   },
}));

vi.mock("../utils/wordupQuestionGenerator", () => ({
   generateWordUpQuestions: vi.fn().mockResolvedValue(
      Array.from({ length: 7 }, (_, i) => ({
         type: "definition",
         prompt: `Fallback question ${i + 1}`,
         choices: ["A", "B", "C", "D"],
         answer: "A",
      })),
   ),
   generateSecretKey: vi.fn(() => "mock-key"),
   encryptQuestions: vi.fn((q: unknown) => JSON.stringify(q)),
   decryptMatchQuestions: vi.fn(async (match: { questions: string }) =>
      JSON.parse(match.questions),
   ),
}));

const makeUuid = (n: number) =>
   `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

function makeQuestions(startIdx: number, count = 7, mode: "hc" | "entity" = "hc") {
   return Array.from({ length: count }, (_, i) => {
      const idx = startIdx + i;
      return {
         type: "definition" as const,
         prompt: `Question prompt #${idx}`,
         choices: ["A", "B", "C", "D"],
         answer: "A",
         ...(mode === "hc" ? { id: makeUuid(idx) } : { entityId: makeUuid(1000 + idx) }),
      };
   });
}

describe("wordupPrefetchCache", () => {
   beforeEach(() => {
      localStorage.clear();
      resetPrefetchLocksForTesting();
      invokeMock.mockReset();
      rpcMock.mockReset();
   });

   it("serializes concurrent prefetchBotMatchInBackground calls and forwards queued question/entity IDs", async () => {
      let callNum = 0;
      invokeMock.mockImplementation(async (_fnName: string, opts: { body: Record<string, unknown> }) => {
         callNum++;
         // Small async delay to simulate network latency
         await new Promise((r) => setTimeout(r, 15));
         if (callNum === 1) {
            const qs = makeQuestions(1, 7, "hc");
            return {
               data: {
                  encryptedQuestions: JSON.stringify(qs),
                  encryptionKey: "k1",
                  chosenEntityIds: [makeUuid(901), makeUuid(902)],
               },
               error: null,
            };
         }
         const qs = makeQuestions(8, 7, "entity");
         return {
            data: {
               encryptedQuestions: JSON.stringify(qs),
               encryptionKey: "k2",
               chosenEntityIds: qs.map((q) => q.entityId),
            },
            error: null,
            _body: opts.body,
         };
      });

      // Fire two concurrent prefetch calls for the same category
      const p1 = prefetchBotMatchInBackground("computers", 2);
      const p2 = prefetchBotMatchInBackground("computers", 2);
      expect(p1).toBe(p2);
      await Promise.all([p1, p2]);

      // Exactly 2 edge function invocations (targetCount=2), never 4 from a race
      expect(invokeMock).toHaveBeenCalledTimes(2);

      const firstBody = invokeMock.mock.calls[0][1].body;
      const secondBody = invokeMock.mock.calls[1][1].body;

      expect(firstBody.isPrefetch).toBe(true);
      expect(secondBody.isPrefetch).toBe(true);

      // Second fetch must exclude both handcrafted IDs and entity IDs queued by the first match
      for (let i = 1; i <= 7; i++) {
         expect(secondBody.excludeQuestionIds).toContain(makeUuid(i));
      }
      expect(secondBody.excludeEntityIds).toContain(makeUuid(901));
      expect(secondBody.excludeEntityIds).toContain(makeUuid(902));

      const raw = JSON.parse(localStorage.getItem("wordup_bot_prefetches") || "{}");
      expect(raw.computers).toHaveLength(2);
      expect(raw.computers[0].cacheVersion).toBe(PREFETCH_CACHE_VERSION);
   });

   it("skips and purges cached matches overlapping with recent question IDs, entity IDs, or prompts", () => {
      const qOverlapMatch: PrefetchedBotMatch = {
         matchId: "bot-match-1",
         category: "computers",
         questions: makeQuestions(1, 7, "hc"),
         encryptedQuestions: "e1",
         encryptionKey: "k1",
         timestamp: Date.now(),
         totalRounds: 7,
         cacheVersion: PREFETCH_CACHE_VERSION,
      };
      const entityOverlapMatch: PrefetchedBotMatch = {
         matchId: "bot-match-2",
         category: "computers",
         questions: makeQuestions(20, 7, "entity"),
         encryptedQuestions: "e2",
         encryptionKey: "k2",
         timestamp: Date.now(),
         totalRounds: 7,
         chosenEntityIds: [makeUuid(1020)],
         cacheVersion: PREFETCH_CACHE_VERSION,
      };
      const promptOverlapMatch: PrefetchedBotMatch = {
         matchId: "bot-match-3",
         category: "computers",
         questions: [
            {
               type: "definition",
               prompt: "  Already   Played   Prompt  ",
               choices: ["A", "B", "C", "D"],
               answer: "A",
            },
            ...makeQuestions(40, 6, "hc"),
         ],
         encryptedQuestions: "e3",
         encryptionKey: "k3",
         timestamp: Date.now(),
         totalRounds: 7,
         cacheVersion: PREFETCH_CACHE_VERSION,
      };
      const cleanMatch: PrefetchedBotMatch = {
         matchId: "bot-match-4",
         category: "computers",
         questions: makeQuestions(60, 7, "hc"),
         encryptedQuestions: "e4",
         encryptionKey: "k4",
         timestamp: Date.now(),
         totalRounds: 7,
         chosenEntityIds: [makeUuid(5001)],
         cacheVersion: PREFETCH_CACHE_VERSION,
      };

      localStorage.setItem(
         "wordup_bot_prefetches",
         JSON.stringify({
            computers: [qOverlapMatch, entityOverlapMatch, promptOverlapMatch, cleanMatch],
         }),
      );

      addRecentQuestionIds("computers", [makeUuid(3)]);
      addRecentEntityIds("computers", [makeUuid(1020)]);
      addRecentPrompts("computers", ["Already played prompt"]);

      // Prevent background replenish from calling real network during this synchronous check
      invokeMock.mockResolvedValue({ data: null, error: null });

      const picked = getPrefetchedBotMatch("computers", 7);
      expect(picked?.matchId).toBe("bot-match-4");

      // All 3 overlapping entries + consumed entry should be removed from cache
      const remaining = JSON.parse(localStorage.getItem("wordup_bot_prefetches") || "{}");
      expect(remaining.computers).toBeUndefined();

      // Consumed match should record its question IDs, entity IDs, and prompts
      expect(getRecentQuestionIds("computers")).toContain(makeUuid(60));
      expect(getRecentEntityIds("computers")).toContain(makeUuid(5001));
      expect(getRecentPrompts("computers")).toContain("question prompt #60");
   });

   it("returns null when all cached matches overlap with recent history", () => {
      const staleMatch: PrefetchedBotMatch = {
         matchId: "bot-match-stale",
         category: "history",
         questions: makeQuestions(1, 7, "hc"),
         encryptedQuestions: "e1",
         encryptionKey: "k1",
         timestamp: Date.now(),
         totalRounds: 7,
         cacheVersion: PREFETCH_CACHE_VERSION,
      };
      localStorage.setItem(
         "wordup_bot_prefetches",
         JSON.stringify({ history: [staleMatch] }),
      );
      addRecentQuestionIds("history", [makeUuid(1)]);
      invokeMock.mockResolvedValue({ data: null, error: null });

      const picked = getPrefetchedBotMatch("history", 7);
      expect(picked).toBeNull();
      const remaining = JSON.parse(localStorage.getItem("wordup_bot_prefetches") || "{}");
      expect(remaining.history).toBeUndefined();
   });

   it("purges legacy cache entries without matching PREFETCH_CACHE_VERSION", () => {
      const legacyEntry: PrefetchedBotMatch = {
         matchId: "bot-match-legacy",
         category: "geography",
         questions: makeQuestions(1, 7, "hc"),
         encryptedQuestions: "e1",
         encryptionKey: "k1",
         timestamp: Date.now(),
         totalRounds: 7,
      };
      const currentEntry: PrefetchedBotMatch = {
         matchId: "bot-match-v2",
         category: "geography",
         questions: makeQuestions(10, 7, "hc"),
         encryptedQuestions: "e2",
         encryptionKey: "k2",
         timestamp: Date.now(),
         totalRounds: 7,
         cacheVersion: PREFETCH_CACHE_VERSION,
      };

      localStorage.setItem(
         "wordup_bot_prefetches",
         JSON.stringify({ geography: [legacyEntry, currentEntry] }),
      );

      cleanExpiredPrefetches();

      const after = JSON.parse(localStorage.getItem("wordup_bot_prefetches") || "{}");
      expect(after.geography).toHaveLength(1);
      expect(after.geography[0].matchId).toBe("bot-match-v2");
   });
});
