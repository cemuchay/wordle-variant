import raw4Official from "./words_4_official.txt?raw";
import raw4Allowed from "./words_4_allowed.txt?raw";
import raw5Official from "./words_5_official.txt?raw";
import raw5Allowed from "./words_5_allowed.txt?raw";
import raw6Allowed from "./words_6_allowed.txt?raw";
import raw7Allowed from "./words_7_allowed.txt?raw";
import raw7Official from "./words_7_official.txt";
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

// 4 & 5 Letter Processing
export const WORDS_4 = processWords(raw4Official);
export const WORDS_4_ALLOWED = processWords(raw4Allowed);
export const WORDS_5 = processWords(raw5Official);
export const WORDS_5_ALLOWED = processWords(raw5Allowed);
export const WORDS_6_ALLOWED = processWords(raw6Allowed);
export const WORDS_7_ALLOWED = processWords(raw7Allowed);
export const WORDS_7 = processWords(raw7Official);
export const WORDS_3_ALLOWED = processWords(raw3Allowed);
export const WORDS_3 = processWords(raw3Official);

// 6 Letter Processing (Flat JSON Array)
export const WORDS_6 = Array.from(
   new Set(data6.map((w: string) => w.toUpperCase()))
).sort();
export const WORDS_6_OFFICIAL = WORDS_6; // Using the same list for allowed guesses

// Master Sets for O(1) validation
export const VALID_GUESSES_4 = new Set([...WORDS_4, ...WORDS_4_ALLOWED]);
export const VALID_GUESSES_5 = new Set([...WORDS_5, ...WORDS_5_ALLOWED]);
export const VALID_GUESSES_6 = new Set([...WORDS_6, ...WORDS_6_ALLOWED]);
export const VALID_GUESSES_7 = new Set([...WORDS_7, ...WORDS_7_ALLOWED]);
export const VALID_GUESSES_3 = new Set([...WORDS_3, ...WORDS_3_ALLOWED]);

/**
 * Dynamic getter for game logic
 */
export const getWordLists = (length: number) => {
   if (length === 4) return { official: WORDS_4, valid: VALID_GUESSES_4 };
   if (length === 6) return { official: WORDS_6, valid: VALID_GUESSES_6 };
   if (length === 7) return { official: WORDS_7, valid: VALID_GUESSES_7 };
   if (length === 3) return { official: WORDS_3, valid: VALID_GUESSES_3 };
   return { official: WORDS_5, valid: VALID_GUESSES_5 };
};
