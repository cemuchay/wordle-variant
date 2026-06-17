import { useState, useRef, useCallback } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { fetchWithRetry } from "../../../../utils/fetchWithRetry";
import {
   generateWordUpQuestions,
   generateSecretKey,
   encryptQuestions,
   getRandomBotProfile,
} from "../../../../utils/wordupQuestionGenerator";

export const useWordUpMatchmaking = (
   user: any,
   category: string,
   getSyncedNow: () => number,
   triggerToast: (msg: string, dur?: number) => void,
   onMatchFound: (matchId: string, role: "player1" | "player2") => void,
   cleanUpIntervals: () => void
) => {
   const [matchId, setMatchId] = useState<string | null>(null);
   const [role, setRole] = useState<"player1" | "player2" | null>(null);
   const queueTimeoutRef = useRef<number | null>(null);
   const matchmakingChannelRef = useRef<any>(null);

   const triggerBotFallback = useCallback(async () => {
      if (!user) return;
      cleanUpIntervals();

      try {
         await fetchWithRetry(async () => {
            const { error } = await supabase.from("wordup_queue").delete().eq("user_id", user.id);
            if (error) throw error;
         }, 3, 1000);
      } catch (e) {
         console.warn("Queue purge failed, continuing:", e);
      }

      const botProfile = getRandomBotProfile();
      const rawQuestions = generateWordUpQuestions(category);
      const secretKey = generateSecretKey();
      const encryptedStr = encryptQuestions(rawQuestions, secretKey);

      try {
         const data = await fetchWithRetry(async () => {
            const { data, error } = await supabase
               .from("wordup_matches")
               .insert({
                  category,
                  player1_id: user.id,
                  player2_id: null,
                  is_bot_match: true,
                  bot_profile: botProfile,
                  questions: encryptedStr,
                  encryption_key: secretKey,
                  status: "countdown",
                  question_started_at: new Date(getSyncedNow()).toISOString()
               })
               .select()
               .single();
            if (error) throw error;
            return data;
         }, 3, 1000);

         if (data) {
            setMatchId(data.id);
            setRole("player1");
            onMatchFound(data.id, "player1");
         }
      } catch (err) {
         console.error("Bot match insertion failed:", err);
      }
   }, [user, category, getSyncedNow, cleanUpIntervals, onMatchFound]);

   const subscribeToMatchmaking = useCallback(() => {
      const channel = supabase
         .channel(`wordup_lobby_${user?.id}`)
         .on(
            "postgres_changes",
            {
               event: "INSERT",
               schema: "public",
               table: "wordup_matches",
               filter: `player1_id=eq.${user?.id}`
            },
            async (payload) => {
               const match = payload.new;
               if (match.status === "countdown" || match.status === "waiting") {
                  cleanUpIntervals();
                  setMatchId(match.id);
                  setRole("player1");
                  onMatchFound(match.id, "player1");
               }
            }
         )
         .on(
            "postgres_changes",
            {
               event: "UPDATE",
               schema: "public",
               table: "wordup_matches",
               filter: `player1_id=eq.${user?.id}`
            },
            async (payload) => {
               const match = payload.new;
               if (match.status === "countdown") {
                  cleanUpIntervals();
                  setMatchId(match.id);
                  setRole("player1");
                  onMatchFound(match.id, "player1");
               }
            }
         )
         .subscribe();

      matchmakingChannelRef.current = channel;
   }, [user, cleanUpIntervals, onMatchFound]);

   const startMatchmaking = useCallback(async () => {
      if (!user) {
         window.dispatchEvent(new CustomEvent("open-auth-modal"));
         return;
      }

      cleanUpIntervals();

      try {
         const result = await fetchWithRetry(async () => {
            const { data, error } = await supabase.rpc("join_wordup_queue", {
               p_user_id: user.id,
               p_category: category
            });
            if (error) throw error;
            return typeof data === "string" ? JSON.parse(data) : data;
         }, 3, 1000);

         if (result.status === "queued" || !result.match_id) {
            setRole("player1");
            setMatchId(null);
            queueTimeoutRef.current = window.setTimeout(() => {
               triggerBotFallback();
            }, 5000);
            subscribeToMatchmaking();
         } else {
            const newMatchId = result.match_id;
            setMatchId(newMatchId);
            setRole("player2");

            const rawQuestions = generateWordUpQuestions(category);
            const secretKey = generateSecretKey();
            const encryptedStr = encryptQuestions(rawQuestions, secretKey);

            await fetchWithRetry(async () => {
               const { error: updateError } = await supabase
                  .from("wordup_matches")
                  .update({
                     questions: encryptedStr,
                     encryption_key: secretKey,
                     status: "countdown",
                     question_started_at: new Date(getSyncedNow()).toISOString()
                  })
                  .eq("id", newMatchId);
               if (updateError) throw updateError;
            }, 3, 1000);

            onMatchFound(newMatchId, "player2");
         }
      } catch (err: any) {
         console.error("Matchmaking startup failed:", err);
         triggerToast("Failed to join arena. Please try again.", 4000);
      }
   }, [user, category, triggerToast, triggerBotFallback, subscribeToMatchmaking, onMatchFound, cleanUpIntervals]);

   const cancelMatchmaking = useCallback(async () => {
      cleanUpIntervals();
      if (user) {
         await fetchWithRetry(async () => {
            const { error } = await supabase.from("wordup_queue").delete().eq("user_id", user.id);
            if (error) throw error;
         }, 3, 1000);
      }
      if (matchmakingChannelRef.current) {
         supabase.removeChannel(matchmakingChannelRef.current);
      }
   }, [user, cleanUpIntervals]);

   return {
      matchId,
      role,
      startMatchmaking,
      cancelMatchmaking,
      matchmakingChannelRef
   };
};
