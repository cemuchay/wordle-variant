import { useRef, useCallback } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { fetchWithRetry } from "../../../../utils/fetchWithRetry";
import {
   generateWordUpQuestions,
   generateSecretKey,
   encryptQuestions,
} from "../../../../utils/wordupQuestionGenerator";
import { useWordUpStore } from "../../../../store/useWordUpStore";
import { wordupNetworkGate } from "../services/wordupNetworkGate";

export const useWordUpMatchmaking = (
   user: any,
   category: string,
   getSyncedNow: () => number,
   triggerToast: (msg: string, dur?: number) => void,
   onMatchFound: (matchId: string, role: "player1" | "player2") => void,
   cleanUpIntervals: () => void
) => {
   const matchId = useWordUpStore((s) => s.matchId);
   const setMatchId = useWordUpStore((s) => s.setMatchId);
   const role = useWordUpStore((s) => s.role);
   const setRole = useWordUpStore((s) => s.setRole);
   const countdownSecs = useWordUpStore((s) => s.countdownSecs);
   const setCountdownSecs = useWordUpStore((s) => s.setCountdownSecs);
   const matchmakingIntervalRef = useRef<number | null>(null);
   const matchmakingChannelRef = useRef<any>(null);
   const isStartingRef = useRef(false);

   const cleanUpMatchmaking = useCallback(() => {
      cleanUpIntervals();
      if (matchmakingIntervalRef.current) {
         clearInterval(matchmakingIntervalRef.current);
         matchmakingIntervalRef.current = null;
      }
   }, [cleanUpIntervals]);

   const triggerBotFallback = useCallback(async () => {
      if (!user) return;
      cleanUpMatchmaking();

      try {
         await wordupNetworkGate.enqueue(
            'delete',
            'delete self from queue before bot match',
            () => fetchWithRetry(async () => {
               const { error } = await supabase.from("wordup_queue").delete().eq("user_id", user.id);
               if (error) throw error;
            }, 3, 1000)
         );
      } catch (e) {
         console.warn("Queue purge failed, continuing:", e);
      }

      const localMatchId = `bot-match-${crypto.randomUUID()}`;
       
      setMatchId(localMatchId);
      setRole("player1");
      onMatchFound(localMatchId, "player1");
   }, [user, category, cleanUpMatchmaking, onMatchFound]);

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
                  cleanUpMatchmaking();
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
                  cleanUpMatchmaking();
                  setMatchId(match.id);
                  setRole("player1");
                  onMatchFound(match.id, "player1");
               }
            }
         )
         .subscribe();

      matchmakingChannelRef.current = channel;
   }, [user, cleanUpMatchmaking, onMatchFound]);
 

   const startMatchmaking = useCallback(async () => {
      if (isStartingRef.current) {
         console.warn("Matchmaking request already in progress, ignoring duplicate request.");
         return;
      }
      if (!user) {
         window.dispatchEvent(new CustomEvent("open-auth-modal"));
         return;
      }

      isStartingRef.current = true;
      cleanUpMatchmaking();

      try {
         const result = await wordupNetworkGate.enqueue(
            'rpc',
            'join matchmaking queue (RPC)',
            () => fetchWithRetry(async () => {
               const { data, error } = await supabase.rpc("join_wordup_queue", {
                  p_user_id: user.id,
                  p_category: category
               });
               if (error) throw error;
               return typeof data === "string" ? JSON.parse(data) : data;
            }, 3, 1000),
            true // blocking operation
         );

         if (result.status === "queued" || !result.match_id) {
            useWordUpStore.getState().setView("matchmaking");
            setRole("player1");
            setMatchId(null);
            setCountdownSecs(6);

            matchmakingIntervalRef.current = window.setInterval(() => {
               const current = useWordUpStore.getState().countdownSecs;
               if (current <= 1) {
                  if (matchmakingIntervalRef.current) {
                     clearInterval(matchmakingIntervalRef.current);
                     matchmakingIntervalRef.current = null;
                  }
                  setCountdownSecs(0);
                  triggerBotFallback();
               } else {
                  setCountdownSecs(current - 1);
               }
            }, 1000);

            subscribeToMatchmaking();
         } else {
            const newMatchId = result.match_id;
            setMatchId(newMatchId);
            setRole("player2");

            const rawQuestions = generateWordUpQuestions(category);
            const secretKey = generateSecretKey();
            const encryptedStr = encryptQuestions(rawQuestions, secretKey);

            await wordupNetworkGate.enqueue(
               'put',
               'update match questions and key',
               () => fetchWithRetry(async () => {
                  const { error: updateError } = await supabase
                     .from("wordup_matches")
                     .update({
                        questions: encryptedStr,
                        encryption_key: secretKey,
                        status: "countdown",
                        game_type: "live",
                        question_started_at: new Date(getSyncedNow()).toISOString()
                     })
                     .eq("id", newMatchId);
                  if (updateError) throw updateError;
               }, 3, 1000)
            );

            onMatchFound(newMatchId, "player2");
         }
      } catch (err: any) {
         console.error("Matchmaking startup failed:", err);
         useWordUpStore.getState().setView("menu");
         triggerToast("Failed to join arena. Please try again.", 4000);
      } finally {
         isStartingRef.current = false;
      }
   }, [user, category, triggerToast, triggerBotFallback, subscribeToMatchmaking, onMatchFound, cleanUpMatchmaking, getSyncedNow]);

   const cancelMatchmaking = useCallback(async () => {
      cleanUpMatchmaking();
      if (user) {
         try {
            await wordupNetworkGate.enqueue(
               'delete',
               'cancel matchmaking queue',
               () => fetchWithRetry(async () => {
                  const { error } = await supabase.from("wordup_queue").delete().eq("user_id", user.id);
                  if (error) throw error;
               }, 3, 1000)
            );
         } catch (e) {
            console.error("Failed to cancel matchmaking:", e);
         }
      }
      if (matchmakingChannelRef.current) {
         supabase.removeChannel(matchmakingChannelRef.current);
      }
   }, [user, cleanUpMatchmaking]);

   return {
      matchId,
      role,
      countdownSecs,
      startMatchmaking,
      cancelMatchmaking,
      matchmakingChannelRef
   };
};
