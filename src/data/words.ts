import raw4Official from "./words_4_official.txt?raw";
import raw4Allowed from "./words_4_allowed.txt?raw";
import raw5Official from "./words_5_official.txt?raw";
import raw5Allowed from "./words_5_allowed.txt?raw";
import raw6Allowed from "./words_6_allowed.txt?raw";
import raw7Allowed from "./words_7_allowed.txt?raw";
import raw7Official from "./words_7_official.txt?raw";
import raw3Allowed from "./words_3_allowed.txt?raw";
import raw3Official from "./words_3_official.txt?raw";

// Import the flat array from your JSON
import data6 from "./words_6_official.json";

const processWords = (rawContent: string): string[] => {
   return Array.from(
      new Set(
         rawContent
            .split(/\s+/)
            .map((w) => w.trim().toUpperCase())
            .filter((w) => w.length > 0)
      )
   ).sort();
};

interface WordListCache {
   official: string[];
   valid: Set<string>;
}

const cache: Record<number, WordListCache> = {};

/**
 * Dynamic getter for game logic (lazily initialized and cached)
 */
export const getWordLists = (length: number): WordListCache => {
   if (cache[length]) {
      return cache[length];
   }

   let official: string[] = [];
   let valid: Set<string> = new Set();

   if (length === 3) {
      const off = processWords(raw3Official);
      const all = processWords(raw3Allowed);
      official = off;
      valid = new Set([...off, ...all]);
   } else if (length === 4) {
      const off = processWords(raw4Official);
      const all = processWords(raw4Allowed);
      official = off;
      valid = new Set([...off, ...all]);
   } else if (length === 6) {
      const off = Array.from(
         new Set(data6.map((w: string) => w.toUpperCase()))
      ).sort();
      const all = processWords(raw6Allowed);
      official = off;
      valid = new Set([...off, ...all]);
   } else if (length === 7) {
      const off = processWords(raw7Official);
      const all = processWords(raw7Allowed);
      official = off;
      valid = new Set([...off, ...all]);
   } else {
      // Default to 5-letter
      const off = processWords(raw5Official);
      const all = processWords(raw5Allowed);
      official = off;
      valid = new Set([...off, ...all]);
   }

   cache[length] = { official, valid };
   return cache[length];
};

// Lazy getters exported for Admin Dashboard to prevent execution at module startup
export const getWORDS_3 = () => getWordLists(3).official;
export const getWORDS_4 = () => getWordLists(4).official;
