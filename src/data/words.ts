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

const memoryCache = new Map<string, WordListCache>();
const pending = new Map<string, Promise<WordListCache>>();

async function fetchAndCache(length: number, isChallenge = false): Promise<WordListCache> {
   const cacheKey = `${length}_${isChallenge}`;
   // 1. Try to read from IndexedDB cache first
   try {
      const cached = await getCachedWords(length, isChallenge);
      if (cached) {
         const result: WordListCache = {
            official: cached.official,
            valid: new Set(cached.valid),
         };
         memoryCache.set(cacheKey, result);
         return result;
      }
   } catch (e) {
      console.warn('Failed to load from IndexedDB cache:', e);
   }

   // 2. Fallback to network fetch
   const hasStrippedFile = [3, 4, 6, 7, 8, 9, 10].includes(length);
   const [officialRaw, allowedRaw, strippedRaw] = await Promise.all([
      fetch(`/words/words_${length}_official.txt`).then(r => r.text()),
      fetch(`/words/words_${length}_allowed.txt`).then(r => r.text()),
      (isChallenge && hasStrippedFile)
         ? fetch(`/words/words_${length}_official_stripped.txt`).then(r => r.text())
         : Promise.resolve(null),
   ]);

   const originalOfficial = processWords(officialRaw);
   const allWords = processWords(allowedRaw);
   const official = strippedRaw ? processWords(strippedRaw) : originalOfficial;

   const result: WordListCache = {
      official,
      valid: new Set([...originalOfficial, ...allWords]),
   };

   memoryCache.set(cacheKey, result);
   cacheWords(length, official, result.valid, isChallenge);

   return result;
}

export async function loadWordLists(length: number, isChallenge = false): Promise<WordListCache> {
   const len = [3, 4, 5, 6, 7, 8, 9, 10].includes(length) ? length : 5;
   const cacheKey = `${len}_${isChallenge}`;

   // 1. In-memory hot cache
   const mem = memoryCache.get(cacheKey);
   if (mem) return mem;

   // 2. Deduplicate in-flight operations (IndexedDB lookup / Network fetch)
   let inflight = pending.get(cacheKey);
   if (!inflight) {
      inflight = fetchAndCache(len, isChallenge);
      pending.set(cacheKey, inflight);
   }

   try {
      const result = await inflight;
      pending.delete(cacheKey);
      return result;
   } catch (e) {
      pending.delete(cacheKey);
      throw e;
   }
}

// Preload word lists on bootstrap to populate memory cache & IndexedDB
const PRELOAD_LENGTHS = [4, 5, 6, 7];
PRELOAD_LENGTHS.forEach(l => {
   loadWordLists(l, false).catch(() => {});
   if (l !== 5) {
      loadWordLists(l, true).catch(() => {});
   }
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
