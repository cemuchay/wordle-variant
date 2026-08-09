import { MAX_ATTEMPTS } from "@/constants/game";
import type { GameConfig } from "@/types/game";
import { getUnconstrainedDailyConfig, getWordAtDate } from "..";

const HISTORICAL_AUTH_WORDS: Record<string, { word: string; length: number }> =
   {
      "2026-05-18": { word: "PESTER", length: 6 },
      "2026-05-19": { word: "BORNE", length: 5 },
      "2026-05-20": { word: "PROF", length: 4 },
      "2026-05-21": { word: "SMELL", length: 5 },
      "2026-05-22": { word: "BRUNT", length: 5 },
      "2026-05-23": { word: "LEGGY", length: 5 },
      "2026-05-24": { word: "CHIRPY", length: 6 },
      "2026-05-25": { word: "ESCROW", length: 6 },
      "2026-05-26": { word: "TRUST", length: 5 },
      "2026-05-27": { word: "SCUBA", length: 5 },
      "2026-05-28": { word: "SCION", length: 5 },
      "2026-05-29": { word: "VISITOR", length: 7 },
      "2026-05-30": { word: "TUTOR", length: 5 },
      "2026-05-31": { word: "META", length: 4 },
      "2026-06-01": { word: "WIGGLE", length: 6 },
      "2026-06-02": { word: "ODE", length: 3 },
      "2026-06-03": { word: "SAFETY", length: 6 },
      "2026-06-04": { word: "DUNCE", length: 5 },
      "2026-06-05": { word: "QUILTS", length: 6 },
      "2026-06-06": { word: "BOOK", length: 4 },
      "2026-06-07": { word: "SIP", length: 3 },
      "2026-06-08": { word: "MORPH", length: 5 },
      "2026-06-09": { word: "YIELDS", length: 6 },
      "2026-06-10": { word: "OTHER", length: 5 },
      "2026-06-11": { word: "ASSERT", length: 6 },
      "2026-06-12": { word: "DRUNKEN", length: 7 },
      "2026-06-13": { word: "ARRIVE", length: 6 },
      "2026-06-14": { word: "HIPPO", length: 5 },
      "2026-06-15": { word: "COOKED", length: 6 },
      "2026-06-16": { word: "FALSE", length: 5 },
      "2026-06-17": { word: "RAGE", length: 4 },
      "2026-06-18": { word: "RUMBLE", length: 6 },
      "2026-06-19": { word: "HELLO", length: 5 },
      "2026-06-20": { word: "ACCEPT", length: 6 },
      "2026-06-21": { word: "HEADY", length: 5 },
      "2026-06-22": { word: "DIAPERS", length: 7 },
      "2026-06-23": { word: "POUTY", length: 5 },
      "2026-06-24": { word: "BIDDER", length: 6 },
      "2026-06-25": { word: "BUILD", length: 5 },
      "2026-06-26": { word: "PENDING", length: 7 },
      "2026-06-27": { word: "TEAM", length: 4 },
      "2026-06-28": { word: "GAUGES", length: 6 },
      "2026-06-29": { word: "LURE", length: 4 },
      "2026-06-30": { word: "FRIAR", length: 5 },
      "2026-07-01": { word: "COMING", length: 6 },
      "2026-07-02": { word: "ZESTY", length: 5 },
      "2026-07-03": { word: "TORRENT", length: 7 },
      "2026-07-04": { word: "PLUNK", length: 5 },
      "2026-07-05": { word: "ODOR", length: 4 },
      "2026-07-06": { word: "AWESOME", length: 7 },
      "2026-07-07": { word: "FOLLY", length: 5 },
      "2026-07-08": { word: "SHEETS", length: 6 },
      "2026-07-09": { word: "LIEGE", length: 5 },
      "2026-07-10": { word: "ADVISE", length: 6 },
      "2026-07-11": { word: "HOBBIES", length: 7 },
      "2026-07-12": { word: "FROND", length: 5 },
      "2026-07-13": { word: "BARBER", length: 6 },
      "2026-07-14": { word: "STANDBY", length: 7 },
      "2026-07-15": { word: "SPOKEN", length: 6 },
      "2026-07-16": { word: "SCOWL", length: 5 },
      "2026-07-17": { word: "NESTING", length: 7 },
      "2026-07-18": { word: "SWATH", length: 5 },
      "2026-07-19": { word: "GAMBLE", length: 6 },
      "2026-07-20": { word: "PHOTO", length: 5 },
      "2026-07-21": { word: "GRATIS", length: 6 },
      "2026-07-22": { word: "LADLE", length: 5 },
      "2026-07-23": { word: "FRIEND", length: 6 },
      "2026-07-24": { word: "DENY", length: 4 },
      "2026-07-25": { word: "FOUGHT", length: 6 },
      "2026-07-26": { word: "ELEMENT", length: 7 },
      "2026-07-27": { word: "INDEXES", length: 7 },
      "2026-07-28": { word: "FREE", length: 4 },
      "2026-07-29": { word: "BILLED", length: 6 },
      "2026-07-30": { word: "STANK", length: 5 },
      "2026-07-31": { word: "FLOORS", length: 6 },
   };

const HISTORICAL_GUEST_WORDS: Record<string, { word: string; length: number }> =
   {
      "2026-05-18": { word: "FOH", length: 3 },
      "2026-05-19": { word: "ALBA", length: 4 },
      "2026-05-20": { word: "FILM", length: 4 },
      "2026-05-21": { word: "HOAX", length: 4 },
      "2026-05-22": { word: "ABSORB", length: 6 },
      "2026-05-23": { word: "ARRAIGN", length: 7 },
      "2026-05-24": { word: "FEARED", length: 6 },
      "2026-05-25": { word: "ELDER", length: 5 },
      "2026-05-26": { word: "UPKEEP", length: 6 },
      "2026-05-27": { word: "SPOKE", length: 5 },
      "2026-05-28": { word: "MINER", length: 5 },
      "2026-05-29": { word: "VOLS", length: 4 },
      "2026-05-30": { word: "NEVER", length: 5 },
      "2026-05-31": { word: "WISE", length: 4 },
      "2026-06-01": { word: "STORY", length: 5 },
      "2026-06-02": { word: "STYLUS", length: 6 },
      "2026-06-03": { word: "DROVE", length: 5 },
      "2026-06-04": { word: "NEURAL", length: 6 },
      "2026-06-05": { word: "JUNK", length: 4 },
      "2026-06-06": { word: "ABSURD", length: 6 },
      "2026-06-07": { word: "MAZE", length: 4 },
      "2026-06-08": { word: "WINCH", length: 5 },
      "2026-06-09": { word: "SUSPECT", length: 7 },
      "2026-06-10": { word: "ADEPT", length: 5 },
      "2026-06-11": { word: "DRESSES", length: 7 },
      "2026-06-12": { word: "FAMOUS", length: 6 },
      "2026-06-13": { word: "BOOM", length: 4 },
      "2026-06-14": { word: "INJURY", length: 6 },
      "2026-06-15": { word: "AIRFARE", length: 7 },
      "2026-06-16": { word: "TIES", length: 4 },
      "2026-06-17": { word: "ZESTY", length: 5 },
      "2026-06-18": { word: "BREADTH", length: 7 },
      "2026-06-19": { word: "CLOSES", length: 6 },
      "2026-06-20": { word: "VOID", length: 4 },
      "2026-06-21": { word: "IDIOM", length: 5 },
      "2026-06-22": { word: "WRITER", length: 6 },
      "2026-06-23": { word: "SENSING", length: 7 },
      "2026-06-24": { word: "OPINE", length: 5 },
      "2026-06-25": { word: "ARTS", length: 4 },
      "2026-06-26": { word: "INCLUDE", length: 7 },
      "2026-06-27": { word: "AWAKE", length: 5 },
      "2026-06-28": { word: "PACE", length: 4 },
      "2026-06-29": { word: "PORTION", length: 7 },
      "2026-06-30": { word: "RECAP", length: 5 },
      "2026-07-01": { word: "PARCELS", length: 7 },
      "2026-07-02": { word: "FLACK", length: 5 },
      "2026-07-03": { word: "SUFFERS", length: 7 },
      "2026-07-04": { word: "SCALAR", length: 6 },
      "2026-07-05": { word: "CARD", length: 4 },
      "2026-07-06": { word: "LETTERS", length: 7 },
      "2026-07-07": { word: "CARMEN", length: 6 },
      "2026-07-08": { word: "DUMPY", length: 5 },
      "2026-07-09": { word: "FIGURE", length: 6 },
      "2026-07-10": { word: "STRIP", length: 5 },
      "2026-07-11": { word: "WEIGHED", length: 7 },
      "2026-07-12": { word: "BUSED", length: 5 },
      "2026-07-13": { word: "DRAPER", length: 6 },
      "2026-07-14": { word: "ALLOT", length: 5 },
      "2026-07-15": { word: "HOSTAGE", length: 7 },
      "2026-07-16": { word: "SIERRA", length: 6 },
      "2026-07-17": { word: "TOBY", length: 4 },
      "2026-07-18": { word: "ANVIL", length: 5 },
      "2026-07-19": { word: "JUMPED", length: 6 },
      "2026-07-20": { word: "TULLE", length: 5 },
      "2026-07-21": { word: "WALKER", length: 6 },
      "2026-07-22": { word: "SHOP", length: 4 },
      "2026-07-23": { word: "SALLY", length: 5 },
      "2026-07-24": { word: "GRID", length: 4 },
      "2026-07-25": { word: "REALM", length: 5 },
      "2026-07-26": { word: "SNATCH", length: 6 },
      "2026-07-27": { word: "LOOSELY", length: 7 },
      "2026-07-28": { word: "QUIT", length: 4 },
      "2026-07-29": { word: "OPENLY", length: 6 },
      "2026-07-30": { word: "SALVE", length: 5 },
      "2026-07-31": { word: "GREENS", length: 6 },
   };

const dailyConfigCache: Record<string, GameConfig> = {};
const START_CONSTRAINT_DATE = "2026-05-29";

const formatDateString = (date: Date): string => {
   return date.toISOString().split("T")[0];
};

export async function getDailyConfigSub(
   isAuthenticated: boolean,
   dateOverride?: string,
): Promise<GameConfig> {
   const dateStr = dateOverride || formatDateString(new Date());

   const cacheKey = `${dateStr}_auth_${isAuthenticated}`;
   if (dailyConfigCache[cacheKey]) {
      return dailyConfigCache[cacheKey];
   }

   // Intercept with hardcoded historical configuration to keep consistency across dictionary updates
   const historicalMap = isAuthenticated
      ? HISTORICAL_AUTH_WORDS
      : HISTORICAL_GUEST_WORDS;
   if (historicalMap[dateStr]) {
      const config: GameConfig = {
         word: historicalMap[dateStr].word,
         length: historicalMap[dateStr].length as 5 | 6 | 4 | 3 | 7,
         maxAttempts: MAX_ATTEMPTS,
      };
      dailyConfigCache[cacheKey] = config;
      return config;
   }

   // 1. If target date is before the constraint date, use the legacy algorithm directly.
   if (dateStr < START_CONSTRAINT_DATE) {
      const config = await getUnconstrainedDailyConfig(
         isAuthenticated,
         dateStr,
      );
      dailyConfigCache[cacheKey] = config;
      return config;
   }

   // 2. Sequential/Iterative generation from May 29th, 2026 up to targetDate.
   const loopStart = new Date(START_CONSTRAINT_DATE);
   const targetDate = new Date(dateStr);

   // Pre-populate the cache for the 14 days preceding START_CONSTRAINT_DATE.
   for (let i = 14; i >= 1; i--) {
      const d = new Date(loopStart);
      d.setDate(loopStart.getDate() - i);
      const dStr = formatDateString(d);
      const k = `${dStr}_auth_${isAuthenticated}`;
      if (!dailyConfigCache[k]) {
         const hist = (
            isAuthenticated ? HISTORICAL_AUTH_WORDS : HISTORICAL_GUEST_WORDS
         )[dStr];
         if (hist) {
            dailyConfigCache[k] = {
               word: hist.word,
               length: hist.length as 5 | 6 | 4 | 3 | 7,
               maxAttempts: MAX_ATTEMPTS,
            };
         } else {
            dailyConfigCache[k] = await getUnconstrainedDailyConfig(
               isAuthenticated,
               dStr,
            );
         }
      }
   }

   // Calculate day-by-day sequentially up to targetDate.
   const current = new Date(loopStart);
   while (current <= targetDate) {
      const currentStr = formatDateString(current);
      const currentKey = `${currentStr}_auth_${isAuthenticated}`;

      if (!dailyConfigCache[currentKey]) {
         const hist = (
            isAuthenticated ? HISTORICAL_AUTH_WORDS : HISTORICAL_GUEST_WORDS
         )[currentStr];
         if (hist) {
            dailyConfigCache[currentKey] = {
               word: hist.word,
               length: hist.length as 5 | 6 | 4 | 3 | 7,
               maxAttempts: MAX_ATTEMPTS,
            };
         } else {
            // Find history of last days using final cached values (18 months / 540 days starting June 22, 2026, otherwise 14 days)
            const history = new Set<string>();
            const lookbackDays = currentStr >= "2026-06-22" ? 540 : 14;
            for (let i = 1; i <= lookbackDays; i++) {
               const prev = new Date(current);
               prev.setDate(current.getDate() - i);
               const prevStr = formatDateString(prev);
               const prevKey = `${prevStr}_auth_${isAuthenticated}`;
               let prevConfig = dailyConfigCache[prevKey];
               if (!prevConfig) {
                  prevConfig = await getDailyConfigSub(
                     isAuthenticated,
                     prevStr,
                  );
               }
               if (prevConfig) {
                  history.add(prevConfig.word);
               }
            }

            // Find yesterday's length from final cached values
            const yesterday = new Date(current);
            yesterday.setDate(current.getDate() - 1);
            const yesterdayStr = formatDateString(yesterday);
            const yesterdayKey = `${yesterdayStr}_auth_${isAuthenticated}`;
            const yesterdayConfig = dailyConfigCache[yesterdayKey];
            const prevLength = yesterdayConfig ? yesterdayConfig.length : null;

            // Generate today's word and enforce both history and non-consecutive length constraints
            let attempt = 0;
            let word: string;
            let length: 5 | 6 | 4 | 3 | 7;

            do {
               word = await getWordAtDate(currentStr, isAuthenticated, attempt);
               length = word.length as 5 | 6 | 4 | 3 | 7;
               attempt++;
            } while (
               (history.has(word) ||
                  (prevLength !== null && length === prevLength)) &&
               attempt < 100
            );

            dailyConfigCache[currentKey] = {
               word,
               length,
               maxAttempts: MAX_ATTEMPTS,
            };
         }
      }

      current.setDate(current.getDate() + 1);
   }

   return dailyConfigCache[cacheKey];
}
