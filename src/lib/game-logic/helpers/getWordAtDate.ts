import { loadWordLists } from "@/data/words";

/**
 * Mulberry32 PRNG (Pseudo-Random Number Generator).
 *
 * @why We use this because it's lightweight and deterministic. Given the same seed,
 * it always produces the same sequence of numbers. This ensures every user
 * gets the same daily word regardless of their device or time zone (when using server time).
 *
 * @param seed - The numeric seed to initialize the generator.
 */
const mulberry32 = (seed: number) => {
   return function () {
      let t = (seed += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
   };
};

/**
 * Legacy hashing algorithm used before May 3rd, 2026.
 *
 * @what Simple summation of character codes.
 * @why Pre-existing games depend on this seed generation.
 * @deprecated Prone to collisions.
 */
const oldHash = (str: string) =>
   str
      .split("")
      .reduce((acc, char, i) => acc + char.charCodeAt(0) * (i + 1), 0);

/**
 * Improved hashing algorithm (djb2-style) used from May 3rd, 2026.
 *
 * @what Bitwise shifts and additions to create a unique integer from a string.
 * @why Significantly reduces seed collisions, ensuring more unique daily words.
 */
const newHash = (str: string) =>
   str
      .split("")
      .reduce((acc, char) => ((acc << 5) - acc + char.charCodeAt(0)) | 0, 0);

const SALT = "GFARMS_BETA_V2";
const GUEST_SALT = "GFARMS_GUEST_V1";
const TRANSITION_DATE = "2026-05-03";
const LENGTH_TRANSITION_DATE = "2026-05-11";
const REMOVAL_3L_TRANSITION_DATE = "2026-06-08";
export const UNPREDICTABLE_ROTATION_DATE = "2026-07-27";

/**
 * Calculates ISO year, ISO week number, and day index (0 = Monday, ..., 6 = Sunday) for a given date.
 */
export function getISOWeekInfo(dateStr: string): { year: number; weekNumber: number; dayIndex: number } {
   const [y, m, d] = dateStr.split("-").map(Number);
   const date = new Date(Date.UTC(y, m - 1, d));

   // Day index: Monday = 0, ..., Sunday = 6
   const dayIndex = (date.getUTCDay() + 6) % 7;

   // Target Thursday in current week to determine ISO year and week number
   const target = new Date(date.valueOf());
   target.setUTCDate(target.getUTCDate() + 3 - dayIndex);

   const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
   const firstThursdayDayIndex = (firstThursday.getUTCDay() + 6) % 7;
   firstThursday.setUTCDate(firstThursday.getUTCDate() - firstThursdayDayIndex);

   const weekNumber = 1 + Math.round((target.valueOf() - firstThursday.valueOf()) / 604800000);

   return {
      year: target.getUTCFullYear(),
      weekNumber,
      dayIndex,
   };
}

/**
 * Generates an unpredictable 7-day word length schedule for a given ISO week using PRNG.
 * Pool: [4, 4, 5, 5, 6, 6, 7]
 * Guarantees no two adjacent days share the exact same word length.
 */
export function getWeeklyLengthSchedule(year: number, weekNumber: number): (4 | 5 | 6 | 7)[] {
   const pool: (4 | 5 | 6 | 7)[] = [4, 4, 5, 5, 6, 6, 7];
   const seed = year * 100 + weekNumber;
   const random = mulberry32(seed);

   const schedule = [...pool];
   for (let i = schedule.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [schedule[i], schedule[j]] = [schedule[j], schedule[i]];
   }

   // Post-shuffle pass: Ensure no adjacent matching lengths
   for (let i = 0; i < schedule.length - 1; i++) {
      if (schedule[i] === schedule[i + 1]) {
         const swapIdx = (i + 2) % schedule.length;
         [schedule[i + 1], schedule[swapIdx]] = [schedule[swapIdx], schedule[i + 1]];
      }
   }

   return schedule;
}

/**
 * Returns the deterministic word length scheduled for any date starting July 27th, 2026.
 */
export function getSeededWeeklyWordLength(dateStr: string): 4 | 5 | 6 | 7 {
   const { year, weekNumber, dayIndex } = getISOWeekInfo(dateStr);
   const schedule = getWeeklyLengthSchedule(year, weekNumber);
   return schedule[dayIndex];
}

export async function getWordAtDateSub(
   dateStr: string,
   isAuthenticated: boolean = true,
   attempt = 0,
): Promise<string> {
   const isNew = dateStr >= TRANSITION_DATE;
   const isNewLength = dateStr >= LENGTH_TRANSITION_DATE;
   const isPost3lRemoval = dateStr >= REMOVAL_3L_TRANSITION_DATE;
   const isUnpredictableRotation = dateStr >= UNPREDICTABLE_ROTATION_DATE;

   const activeSalt = isAuthenticated ? SALT : GUEST_SALT;
   const seedBase =
      dateStr + activeSalt + (attempt > 0 ? `_retry_${attempt}` : "");

   const seed = isNew ? newHash(seedBase) : oldHash(seedBase);
   const random = mulberry32(seed);

   let length: 5 | 6 | 4 | 3 | 7;

   if (isUnpredictableRotation) {
      length = getSeededWeeklyWordLength(dateStr);
   } else if (isNewLength) {
      const r = random();
      // Weighted buckets for word length variety
      if (isPost3lRemoval) {
         length =
            r < 0.1
               ? 7 // 10% chance (reallocated from 3l)
               : r < 0.25
                 ? 4 // 15% chance
                 : r < 0.65
                   ? 5 // 40% chance
                   : 6; // 35% chance
      } else {
         length =
            r < 0.05
               ? 3 // 5% chance
               : r < 0.1
                 ? 7 // 5% chance
                 : r < 0.25
                   ? 4 // 15% chance
                   : r < 0.65
                     ? 5 // 40% chance
                     : 6; // 35% chance
      }
   } else {
      length = ([4, 5, 6] as const)[Math.floor(random() * 3)];
   }

   const { official } = await loadWordLists(length);

   return official[Math.floor(random() * official.length)].toUpperCase();
}

