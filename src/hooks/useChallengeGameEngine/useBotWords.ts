/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { logger } from '../../lib/logger';

export const useBotWords = (challenge: any, triggerToast: (msg: string, duration?: number) => void) => {
   const [botDailyWords, setBotDailyWords] = useState<
      Record<number, { word: string; salt: string }>
   >({});

   const fetchBotDailyWords = useCallback(async () => {
      if (!challenge.is_bot_marathon || challenge.target_word !== "MARATHON")
         return;
      try {
         const today = new Intl.DateTimeFormat("en-CA", {
            timeZone: "Africa/Lagos",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
         }).format(new Date());

         const { data, error } = await supabase
            .from("bot_marathon_daily_words")
            .select("*")
            .eq("play_date", today);

         if (error) throw error;

         if (data) {
            const wordsMap: Record<number, { word: string; salt: string }> = {};
            data.forEach((row: any) => {
               wordsMap[row.word_length] = {
                  word: row.target_word,
                  salt: row.salt,
               };
            });
            setBotDailyWords(wordsMap);
         }
      } catch (err: any) {
         logger.error("Failed to fetch bot daily words", { error: err });
         triggerToast("Failed to fetch today's words.", 4000);
      }
   }, [challenge.is_bot_marathon, challenge.target_word, triggerToast]);

   useEffect(() => {
      if (challenge.is_bot_marathon && challenge.target_word === "MARATHON") {
         fetchBotDailyWords();
      }
   }, [challenge.is_bot_marathon, challenge.target_word, fetchBotDailyWords]);

   return { botDailyWords };
};
