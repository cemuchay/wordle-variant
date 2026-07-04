/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useCallback } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { fetchWithRetry } from "../../../../utils/fetchWithRetry";
import { useWordUpStore } from "../../../../store/useWordUpStore";
import { wordupNetworkGate } from "../services/wordupNetworkGate";
import { generateMatchQuestions } from "../../../../services/wordup/questionService";
import { WORDUP_TIMEOUT } from "../../../../constants/wordup";

export const useWordUpMatchmaking = (
   user: any,
   _category: string,
   _getSyncedNow: () => number,
   triggerToast: (msg: string, dur?: number) => void,
   onMatchFound: (matchId: string, role: "player1" | "player2") => void,
   cleanUpIntervals: () => void,
   onlineUserCount: number = 0
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
      if (matchmakingChannelRef.current) {
         supabase.removeChannel(matchmakingChannelRef.current);
         matchmakingChannelRef.current = null;
      }
   }, [cleanUpIntervals]);

   const triggerBotFallback = useCallback(async () => {
      if (!user) return;

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

      cleanUpMatchmaking();

      const localMatchId = `bot-match-${crypto.randomUUID()}`;

      setMatchId(localMatchId);
      setRole("player1");
      onMatchFound(localMatchId, "player1");
   }, [user, cleanUpMatchmaking, onMatchFound]);

   const subscribeToMatchmaking = useCallback(() => {
      if (matchmakingChannelRef.current) {
         supabase.removeChannel(matchmakingChannelRef.current);
         matchmakingChannelRef.current = null;
      }
      const topic = `wordup_lobby_${user?.id}`;
      const existing = supabase.getChannels().find(
         (c: any) => c.topic === `realtime:${topic}`
      );
      if (existing) {
         supabase.removeChannel(existing);
      }

      const channel = supabase
         .channel(topic)
         .on(
            "postgres_changes",
            {
               event: "INSERT",
               schema: "public",
               table: "wordup_matches",
               filter: `player1_id=eq.${user?.id}`
            },
            async (payload) => {
               const match = payload.new as any;
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
                const match = payload.new as any;
                if (match.status === "countdown") {
                   cleanUpMatchmaking();
                   setMatchId(match.id);
                   setRole("player1");
                   onMatchFound(match.id, "player1");
                }
             }
         )
         .subscribe(async (status) => {
            if (status === "SUBSCRIBED" && user?.id) {
               const { data } = await supabase
                  .from("wordup_matches")
                  .select("*")
                  .eq("player1_id", user.id)
                  .in("status", ["waiting", "countdown"])
                  .order("created_at", { ascending: false })
                  .limit(1);
                if (data?.[0]) {
                   const match = data[0] as any;
                   if (match.status === "countdown" || match.status === "waiting") {
                      cleanUpMatchmaking();
                      setMatchId(match.id);
                      setRole("player1");
                      onMatchFound(match.id, "player1");
                   }
                }
            }
         });

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
                    p_category: useWordUpStore.getState().category || "mixed"
                 });
                if (error) throw error;
                return typeof data === "string" ? JSON.parse(data) : data;
             }, 3, 1000),
             true
          );

          if (result.status === "queued" || !result.match_id) {
             // Player1: queued, waiting for opponent
             useWordUpStore.getState().setView("matchmaking");
             setRole("player1");
             setMatchId(null);
              const isNoUsersOnline = onlineUserCount === 0;
              const matchmakingTimeout = isNoUsersOnline ? WORDUP_TIMEOUT.MATCHMAKING_NO_USERS : WORDUP_TIMEOUT.MATCHMAKING;
              setCountdownSecs(Math.floor(matchmakingTimeout / 1000));

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
             // Player2: matched immediately — generate questions via edge function
             const newMatchId = result.match_id;
             setMatchId(newMatchId);
             setRole("player2");

             await generateMatchQuestions(newMatchId, useWordUpStore.getState().category || "mixed");

             // Set match status to countdown for PvP
             await supabase.from("wordup_matches").update({ status: "countdown", question_started_at: new Date(Date.now() + 4500).toISOString() }).eq("id", newMatchId);

             onMatchFound(newMatchId, "player2");
          }
       } catch (err: any) {
          console.error("[WordUp Category] Matchmaking startup failed:", err);
          useWordUpStore.getState().setView("menu");
          const isNetworkError = err?.message?.includes("Failed to fetch") || err?.message?.includes("NetworkError") || err?.status === 0 || err?.code === "NETWORK_ERROR";
          triggerToast(isNetworkError ? "Game servers unreachable. Please check your connection." : "Failed to join arena. Please try again.", 4000);
       } finally {
         isStartingRef.current = false;
      }
   }, [user, triggerToast, triggerBotFallback, subscribeToMatchmaking, onMatchFound, cleanUpMatchmaking]);

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
