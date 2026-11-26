import { supabase } from "../lib/supabaseClient";
import { isProceduralCategory } from "../services/wordup/generatorRegistry";
import {
   generateWordUpQuestions,
   generateSecretKey,
   encryptQuestions,
   decryptMatchQuestions,
} from "./wordupQuestionGenerator";
import type { WordUpQuestion } from "./wordupQuestionGenerator";
import {
   getQuestionRequestContext,
   recordPlayedQuestions,
} from "../wordup/shared/questionHistoryService";
import {
   extractEntityIds,
   extractPromptKeys,
   extractQuestionIds,
   getRecentEntityIds,
   getRecentPrompts,
   getRecentQuestionIds,
   isQuestionUuid,
} from "../wordup/shared/recentQuestions";

export interface PrefetchedBotMatch {
   matchId: string;
   category: string;
   questions: WordUpQuestion[];
   encryptedQuestions: string;
   encryptionKey: string;
   timestamp: number;
   totalRounds?: number;
   chosenEntityIds?: string[];
   cacheVersion?: number;
}

const CACHE_KEY = "wordup_bot_prefetches";
const EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours
export const PREFETCH_CACHE_VERSION = 2;

const inFlightPrefetches = new Map<string, Promise<void>>();

/** Test helper to clear module-level in-flight locks between tests. */
export function resetPrefetchLocksForTesting(): void {
   inFlightPrefetches.clear();
}

// Helper to get raw cache object
function getCache(): Record<string, PrefetchedBotMatch[]> {
   try {
      const data = localStorage.getItem(CACHE_KEY);
      return data ? JSON.parse(data) : {};
   } catch {
      return {};
   }
}

// Helper to save cache object
function saveCache(cache: Record<string, PrefetchedBotMatch[]>) {
   try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
   } catch (e) {
      console.warn(
         "[WordUpPrefetch] Failed to write cache to localStorage:",
         e,
      );
   }
}

/** Clean up prefetched matches older than 24 hours or from older cache versions */
export function cleanExpiredPrefetches() {
   const cache = getCache();
   const now = Date.now();
   let dirty = false;

   Object.keys(cache).forEach((cat) => {
      const list = Array.isArray(cache[cat]) ? cache[cat] : [];
      if (!Array.isArray(cache[cat])) dirty = true;
      const filtered = list.filter((item) => {
         const isValid =
            Boolean(item) &&
            now - item.timestamp < EXPIRATION_MS &&
            item.cacheVersion === PREFETCH_CACHE_VERSION;
         if (!isValid) dirty = true;
         return isValid;
      });
      if (filtered.length === 0) {
         delete cache[cat];
         dirty = true;
      } else {
         cache[cat] = filtered;
      }
   });

   if (dirty) {
      saveCache(cache);
   }
}

/** Generates and returns a single bot match payload */
async function generateBotMatchData(
   category: string,
   extraExcludeIds: string[] = [],
   extraExcludeEntityIds: string[] = [],
): Promise<PrefetchedBotMatch> {
   const rawId = crypto.randomUUID();
   const matchId = `bot-match-${rawId}`;
   let questions: WordUpQuestion[];
   let encryptedQuestions: string;
   let encryptionKey: string;
   let chosenEntityIds: string[] = [];

   if (isProceduralCategory(category)) {
      const seed = `${rawId}-${category}`;
      try {
         const { userId, excludeQuestionIds, excludeEntityIds } =
            await getQuestionRequestContext(
               category,
               extraExcludeIds,
               extraExcludeEntityIds,
            );
         const { data: edgeData } = await supabase.functions.invoke(
            "generate-match-questions",
            {
               body: {
                  matchId: rawId,
                  category,
                  seed,
                  userId,
                  excludeQuestionIds,
                  excludeEntityIds,
                  isPrefetch: true,
               },
            },
         );
         if (edgeData?.encryptedQuestions && edgeData?.encryptionKey) {
            encryptedQuestions = edgeData.encryptedQuestions;
            encryptionKey = edgeData.encryptionKey;
            questions = await decryptMatchQuestions({
               questions: edgeData.encryptedQuestions,
               encryption_key: edgeData.encryptionKey,
               // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
            chosenEntityIds = Array.isArray(edgeData?.chosenEntityIds)
               ? edgeData.chosenEntityIds.filter(isQuestionUuid)
               : extractEntityIds(questions);
         } else {
            questions = await generateWordUpQuestions(category);
            const fKey = generateSecretKey();
            encryptedQuestions = encryptQuestions(questions, fKey);
            encryptionKey = fKey;
         }
      } catch (err) {
         console.warn(
            "[WordUpPrefetch] Edge function call failed, generating fallback questions:",
            err,
         );
         questions = await generateWordUpQuestions(category);
         const fKey = generateSecretKey();
         encryptedQuestions = encryptQuestions(questions, fKey);
         encryptionKey = fKey;
      }
   } else {
      questions = await generateWordUpQuestions(category);
      const fKey = generateSecretKey();
      encryptedQuestions = encryptQuestions(questions, fKey);
      encryptionKey = fKey;
   }

   return {
      matchId,
      category,
      questions,
      encryptedQuestions,
      encryptionKey,
      timestamp: Date.now(),
      totalRounds: questions.length,
      chosenEntityIds,
      cacheVersion: PREFETCH_CACHE_VERSION,
   };
}

function hasOverlapWithRecent(
   item: PrefetchedBotMatch,
   recentQids: Set<string>,
   recentEids: Set<string>,
   recentPrompts: Set<string>,
): boolean {
   const qids = extractQuestionIds(item.questions as Array<{ id?: unknown }>);
   if (qids.some((id) => recentQids.has(id))) return true;

   const eids = [
      ...(item.chosenEntityIds || []).filter(isQuestionUuid),
      ...extractEntityIds(item.questions as Array<{ entityId?: unknown }>),
   ];
   if (eids.some((id) => recentEids.has(id))) return true;

   const prompts = extractPromptKeys(item.questions as Array<{ prompt?: unknown }>);
   if (prompts.some((p) => recentPrompts.has(p))) return true;

   return false;
}

/**
 * Retrieves a prefetched bot match for a category, removes it from cache,
 * skips/purges any cached matches overlapping with recently played questions,
 * and asynchronously kicks off a background fetch to replenish the cache.
 */
export function getPrefetchedBotMatch(
   category: string,
   requiredRounds = 7,
): PrefetchedBotMatch | null {
   cleanExpiredPrefetches();
   const cache = getCache();
   const list = cache[category] || [];

   const recentQids = new Set(getRecentQuestionIds(category));
   const recentEids = new Set(getRecentEntityIds(category));
   const recentPrompts = new Set(getRecentPrompts(category));

   const nextList: PrefetchedBotMatch[] = [];
   let chosenItem: PrefetchedBotMatch | null = null;
   let dirty = false;

   for (const item of list) {
      const rounds = item.totalRounds || item.questions.length;
      if (rounds === requiredRounds) {
         if (!chosenItem && !hasOverlapWithRecent(item, recentQids, recentEids, recentPrompts)) {
            chosenItem = item;
            dirty = true;
            continue;
         }
         if (!chosenItem) {
            // Prune stale/overlapping cached match
            dirty = true;
            continue;
         }
      }
      nextList.push(item);
   }

   if (dirty) {
      if (nextList.length === 0) {
         delete cache[category];
      } else {
         cache[category] = nextList;
      }
      saveCache(cache);
   }

   if (!chosenItem) {
      if (requiredRounds === 7) {
         void prefetchBotMatchInBackground(category);
      }
      return null;
   }

   // Mark consumed prefetch questions as played immediately so back-to-back games
   // and newly replenished prefetches never repeat them.
   recordPlayedQuestions(
      category,
      chosenItem.questions as Array<{ id?: unknown; entityId?: unknown; prompt?: unknown }>,
      chosenItem.chosenEntityIds || [],
   );

   if (requiredRounds === 7) {
      void prefetchBotMatchInBackground(category);
   }

   return chosenItem;
}

/** Pre-populates the cache for a category up to a target size (default: 2 matches) */
export function prefetchBotMatchInBackground(
   category: string,
   targetCount = 2,
): Promise<void> {
   const existing = inFlightPrefetches.get(category);
   if (existing) return existing;

   const workPromise = (async () => {
      try {
         await new Promise((r) => setTimeout(r, 50));
         cleanExpiredPrefetches();

         for (let i = 0; i < targetCount; i++) {
            const cache = getCache();
            const list = cache[category] || [];
            if (list.length >= targetCount) break;

            // Collect IDs already queued in the prefetch cache so queued matches never overlap
            const queuedQuestionIds = Array.from(
               new Set(
                  list.flatMap((m) =>
                     extractQuestionIds(m.questions as Array<{ id?: unknown }>),
                  ),
               ),
            );
            const queuedEntityIds = Array.from(
               new Set(
                  list.flatMap((m) => [
                     ...(m.chosenEntityIds || []).filter(isQuestionUuid),
                     ...extractEntityIds(m.questions as Array<{ entityId?: unknown }>),
                  ]),
               ),
            );

            const matchData = await generateBotMatchData(
               category,
               queuedQuestionIds,
               queuedEntityIds,
            );

            // Re-read cache to avoid race conditions during async fetch
            const latestCache = getCache();
            const latestList = latestCache[category] || [];
            if (latestList.length < targetCount) {
               latestList.push(matchData);
               latestCache[category] = latestList;
               saveCache(latestCache);
            } else {
               break;
            }
         }
      } catch (e) {
         console.error(
            "[WordUpPrefetch] Background prefetch failed for category",
            category,
            e,
         );
      } finally {
         if (inFlightPrefetches.get(category) === workPromise) {
            inFlightPrefetches.delete(category);
         }
      }
   })();

   inFlightPrefetches.set(category, workPromise);
   return workPromise;
}
