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
