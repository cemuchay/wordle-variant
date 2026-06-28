import { getCachedWords, cacheWords } from './wordStorage';

const processWords = (rawContent: string): string[] => {
   return Array.from(
      new Set(
         rawContent
            .split(/\s+/)
            .map((w) => w.trim().toUpperCase())
            .filter((w) => w.length > 0),
      ),
   ).sort();
};

interface WordListCache {
   official: string[];
   valid: Set<string>;
}

const memoryCache = new Map<number, WordListCache>();
const pending = new Map<number, Promise<WordListCache>>();

async function fetchAndCache(length: number): Promise<WordListCache> {
   const [officialRaw, allowedRaw] = await Promise.all([
      fetch(`/words/words_${length}_official.txt`).then(r => r.text()),
      fetch(`/words/words_${length}_allowed.txt`).then(r => r.text()),
   ]);

   const official = processWords(officialRaw);
   const allWords = processWords(allowedRaw);
   const result: WordListCache = {
      official,
      valid: new Set([...official, ...allWords]),
   };

   memoryCache.set(length, result);
   cacheWords(length, official, result.valid);

   return result;
}

export async function loadWordLists(length: number): Promise<WordListCache> {
   const len = [3, 4, 5, 6, 7, 8, 9, 10].includes(length) ? length : 5;

   // 1. In-memory hot cache
   const mem = memoryCache.get(len);
   if (mem) return mem;

   // 2. In-flight — deduplicate concurrent requests
   const inflight = pending.get(len);
   if (inflight) return inflight;

   const promise = fetchAndCache(len);
   pending.set(len, promise);

   try {
      const result = await promise;
      pending.delete(len);
      return result;
   } catch (e) {
      pending.delete(len);
      throw e;
   }
}

/**
 * Preload word lists into the in-memory cache.
 * Fire-and-forget — call at app bootstrap to avoid flashes on the daily path.
 */
const PRELOAD_LENGTHS = [4, 5, 6, 7];
PRELOAD_LENGTHS.forEach(l => {
   // Try IndexedDB first, fall through to dynamic import
   getCachedWords(l).then(cached => {
      if (cached) {
         memoryCache.set(l, { official: cached.official, valid: new Set(cached.valid) });
         return;
      }
      fetchAndCache(l).catch(() => {});
   }).catch(() => {
      fetchAndCache(l).catch(() => {});
   });
});

export const getWORDS_3 = () => loadWordLists(3).then(r => r.official);
export const getWORDS_4 = () => loadWordLists(4).then(r => r.official);
export const getWORDS_5 = () => loadWordLists(5).then(r => r.official);
export const getWORDS_6 = () => loadWordLists(6).then(r => r.official);
export const getWORDS_7 = () => loadWordLists(7).then(r => r.official);
export const getWORDS_8 = () => loadWordLists(8).then(r => r.official);
export const getWORDS_9 = () => loadWordLists(9).then(r => r.official);
export const getWORDS_10 = () => loadWordLists(10).then(r => r.official);

/**
 * Mapping of length to async getter for dynamic selection.
 */
export const OFFICIAL_WORDS: Record<number, () => Promise<string[]>> = {
   3: getWORDS_3,
   4: getWORDS_4,
   5: getWORDS_5,
   6: getWORDS_6,
   7: getWORDS_7,
   8: getWORDS_8,
   9: getWORDS_9,
   10: getWORDS_10,
};
