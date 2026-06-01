import raw3Official from "./words_3_official.txt?raw";
import raw3Allowed from "./words_3_allowed.txt?raw";
import raw4Official from "./words_4_official.txt?raw";
import raw4Allowed from "./words_4_allowed.txt?raw";
import raw5Official from "./words_5_official.txt?raw";
import raw5Allowed from "./words_5_allowed.txt?raw";
import raw6Official from "./words_6_official.txt?raw";
import raw6Allowed from "./words_6_allowed.txt?raw";
import raw7Official from "./words_7_official.txt?raw";
import raw7Allowed from "./words_7_allowed.txt?raw";
import raw8Official from "./words_8_official.txt?raw";
import raw8Allowed from "./words_8_allowed.txt?raw";
import raw9Official from "./words_9_official.txt?raw";
import raw9Allowed from "./words_9_allowed.txt?raw";
import raw10Official from "./words_10_official.txt?raw";
import raw10Allowed from "./words_10_allowed.txt?raw";

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

const cache: Record<number, WordListCache> = {};

/**
 * Dynamic getter for game logic (lazily initialized and cached)
 */
export const getWordLists = (length: number): WordListCache => {
   if (cache[length]) {
      return cache[length];
   }

   let official: string[];
   let valid: Set<string>;

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
      const off = processWords(raw6Official);
      const all = processWords(raw6Allowed);
      official = off;
      valid = new Set([...off, ...all]);
   } else if (length === 7) {
      const off = processWords(raw7Official);
      const all = processWords(raw7Allowed);
      official = off;
      valid = new Set([...off, ...all]);
   } else if (length === 8) {
      const off = processWords(raw8Official);
      const all = processWords(raw8Allowed);
      official = off;
      valid = new Set([...off, ...all]);
   } else if (length === 9) {
      const off = processWords(raw9Official);
      const all = processWords(raw9Allowed);
      official = off;
      valid = new Set([...off, ...all]);
   } else if (length === 10) {
      const off = processWords(raw10Official);
      const all = processWords(raw10Allowed);
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
export const getWORDS_5 = () => getWordLists(5).official;
export const getWORDS_6 = () => getWordLists(6).official;
export const getWORDS_7 = () => getWordLists(7).official;
export const getWORDS_8 = () => getWordLists(8).official;
export const getWORDS_9 = () => getWordLists(9).official;
export const getWORDS_10 = () => getWordLists(10).official;

/**
 * Mapping of length to getter for dynamic selection.
 */
export const OFFICIAL_WORDS: Record<number, () => string[]> = {
   3: getWORDS_3,
   4: getWORDS_4,
   5: getWORDS_5,
   6: getWORDS_6,
   7: getWORDS_7,
   8: getWORDS_8,
   9: getWORDS_9,
   10: getWORDS_10,
};
