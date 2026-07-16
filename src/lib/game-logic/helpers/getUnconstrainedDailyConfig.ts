import { MAX_ATTEMPTS } from "@/constants/game";
import type { GameConfig } from "@/types/game";
import { getWordAtDate } from "..";

const TRANSITION_DATE = "2026-05-03";

const formatDateString = (date: Date): string => {
   return date.toISOString().split("T")[0];
};

export default async function getUnconstrainedDailyConfigSub(
   isAuthenticated: boolean,
   dateStr: string,
): Promise<GameConfig> {
   const isNewEra = dateStr >= TRANSITION_DATE;

   if (!isNewEra) {
      const word = await getWordAtDate(dateStr, isAuthenticated);
      const length = word.length as 4 | 6 | 5;
      return { word, length, maxAttempts: length + 1 };
   }

   const history = new Set<string>();
   const cursor = new Date(dateStr);

   for (let i = 1; i <= 14; i++) {
      const prevDate = new Date(cursor);
      prevDate.setDate(cursor.getDate() - i);
      const prevStr = formatDateString(prevDate);
      history.add(await getWordAtDate(prevStr, isAuthenticated));
   }

   let attempt = 0;
   let word;

   do {
      word = await getWordAtDate(dateStr, isAuthenticated, attempt);
      attempt++;
   } while (history.has(word) && attempt < 50);

   const length = word.length as 5 | 6 | 4 | 3 | 7;

   return {
      word,
      length,
      maxAttempts: MAX_ATTEMPTS,
   };
}
