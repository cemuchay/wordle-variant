import { supabase } from "../lib/supabaseClient";
import { isProceduralCategory } from "../services/wordup/generatorRegistry";
import {
   generateWordUpQuestions,
   generateSecretKey,
   encryptQuestions,
   decryptMatchQuestions,
} from "./wordupQuestionGenerator";
import type { WordUpQuestion } from "./wordupQuestionGenerator";

export interface PrefetchedBotMatch {
   matchId: string;
   category: string;
   questions: WordUpQuestion[];
   encryptedQuestions: string;
   encryptionKey: string;
   timestamp: number;
}

const CACHE_KEY = "wordup_bot_prefetches";
const EXPIRATION_MS = 24 * 60 * 60 * 1000; // 24 hours

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

/** Clean up prefetched matches older than 24 hours */
export function cleanExpiredPrefetches() {
   const cache = getCache();
   const now = Date.now();
   let dirty = false;

   Object.keys(cache).forEach((cat) => {
      const filtered = cache[cat].filter((item) => {
         const isValid = now - item.timestamp < EXPIRATION_MS;
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
): Promise<PrefetchedBotMatch> {
   const rawId = crypto.randomUUID();
   const matchId = `bot-match-${rawId}`;
   let questions: WordUpQuestion[];
   let encryptedQuestions: string;
   let encryptionKey: string;

   if (isProceduralCategory(category)) {
      const seed = `${rawId}-${category}`;
      try {
         const { data: edgeData } = await supabase.functions.invoke(
            "generate-match-questions",
            { body: { matchId: rawId, category, seed } },
         );
         if (edgeData?.encryptedQuestions && edgeData?.encryptionKey) {
            encryptedQuestions = edgeData.encryptedQuestions;
            encryptionKey = edgeData.encryptionKey;
            questions = await decryptMatchQuestions({
               questions: edgeData.encryptedQuestions,
               encryption_key: edgeData.encryptionKey,
               // eslint-disable-next-line @typescript-eslint/no-explicit-any
            } as any);
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
   };
}

/**
 * Retrieves a prefetched bot match for a category, removes it from cache,
 * and asynchronously kicks off a background fetch to replenish the cache.
 */
export function getPrefetchedBotMatch(
   category: string,
): PrefetchedBotMatch | null {
   cleanExpiredPrefetches();
   const cache = getCache();
   const list = cache[category] || [];

   if (list.length === 0) {
      // Cache miss: Trigger background prefetch for next time
      prefetchBotMatchInBackground(category);
      return null;
   }

   const item = list.shift()!;
   cache[category] = list;
   saveCache(cache);

   // Replenish the cache in the background
   prefetchBotMatchInBackground(category);

   return item;
}

/** Pre-populates the cache for a category up to a target size (default: 2 matches) */
export async function prefetchBotMatchInBackground(
   category: string,
   targetCount = 2,
) {
   // Run asynchronously without blocking the caller
   setTimeout(async () => {
      try {
         const cache = getCache();
         const list = cache[category] || [];
         if (list.length >= targetCount) return;

         const needed = targetCount - list.length;
         for (let i = 0; i < needed; i++) {
            const matchData = await generateBotMatchData(category);
            // Re-read cache to avoid race conditions during async loop
            const latestCache = getCache();
            const latestList = latestCache[category] || [];
            latestList.push(matchData);
            latestCache[category] = latestList;
            saveCache(latestCache);
         }
      } catch (e) {
         console.error(
            "[WordUpPrefetch] Background prefetch failed for category",
            category,
            e,
         );
      }
   }, 50);
}
