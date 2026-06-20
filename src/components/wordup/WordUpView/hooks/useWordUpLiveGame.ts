/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useCallback, useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { fetchWithRetry } from "../../../../utils/fetchWithRetry";
import { wordupAudio } from "../../../../utils/wordupAudio";
import { decryptMatchQuestions } from "../../../../utils/wordupQuestionGenerator";
import { generateMatchQuestions } from "../../../../services/wordup/questionService";
import { useWordUpStore } from "../../../../store/useWordUpStore";
import { safeSessionStorage, safeLocalStorage } from "../../../../utils/storage";
import { wordupNetworkGate } from "../services/wordupNetworkGate";
import { getQuestionDuration } from "./useWordUpGameLoop";

export interface LiveGameProps {
   isActive: boolean;
   matchId: string | null;
   role: "player1" | "player2" | null;
   getSyncedNow: () => number;
   triggerToast: (msg: string, dur?: number) => void;
   onGameOver: (match: any) => void;
   onRematchAccepted: (newMatchId: string, role: "player1" | "player2") => void;
}

export const useWordUpLiveGame = ({
   isActive,
   matchId,
   role,
   getSyncedNow,
   triggerToast,
   onGameOver,
   onRematchAccepted,
}: LiveGameProps) => {
   const matchData = useWordUpStore((s) => s.matchData);
   const setMatchData = useWordUpStore((s) => s.setMatchData);
   const questions = useWordUpStore((s) => s.questions);
   const setQuestions = useWordUpStore((s) => s.setQuestions);
   const currentIdx = useWordUpStore((s) => s.currentIdx);
   const setCurrentIdx = useWordUpStore((s) => s.setCurrentIdx);
   const timeLeft = useWordUpStore((s) => s.timeLeft);
   const setTimeLeft = useWordUpStore((s) => s.setTimeLeft);
   const selectedAnswer = useWordUpStore((s) => s.selectedAnswer);
   const setSelectedAnswer = useWordUpStore((s) => s.setSelectedAnswer);
   const revealAnswers = useWordUpStore((s) => s.revealAnswers);
   const setRevealAnswers = useWordUpStore((s) => s.setRevealAnswers);
   const opponentStats = useWordUpStore((s) => s.opponentStats);
   const setOpponentStats = useWordUpStore((s) => s.setOpponentStats);
   const maxTime = useWordUpStore((s) => s.maxTime);
   const setMaxTime = useWordUpStore((s) => s.setMaxTime);

   const [rematchState, setRematchState] = useState<"idle" | "sent" | "received" | "expired">("idle");
   const [rematchCountdown, setRematchCountdown] = useState(10);
   const [showRematchButton, setShowRematchButton] = useState(true);

   const timerRef = useRef<number | null>(null);
   const roundTimeoutRef = useRef<number | null>(null);
   const isSubmittingAnswerRef = useRef(false);
   const isAdvancingRef = useRef(false);
   const isRevealingRef = useRef(false);
   const matchChannelRef = useRef<any>(null);
   const rematchTimerRef = useRef<number | null>(null);

   const currentIdxRef = useRef(currentIdx);
   const matchDataRef = useRef(matchData);
   const questionsRef = useRef(questions);
   const revealAnswersRef = useRef(revealAnswers);
   const timeLeftRef = useRef(timeLeft);
   const roleRef = useRef(role);
   const handleMatchUpdateRef = useRef<(newMatch: any) => void>(null as any);
   const onRematchAcceptedRef = useRef(onRematchAccepted);
   const rematchStateRef = useRef(rematchState);
   const handleAnswerSelectRef = useRef<any>(null);

   useEffect(() => {
      onRematchAcceptedRef.current = onRematchAccepted;
   }, [onRematchAccepted]);

   useEffect(() => {
      rematchStateRef.current = rematchState;
   }, [rematchState]);

   useEffect(() => {
      currentIdxRef.current = currentIdx;
   }, [currentIdx]);
   useEffect(() => {
      matchDataRef.current = matchData;
   }, [matchData]);
   useEffect(() => {
      questionsRef.current = questions;
   }, [questions]);
   useEffect(() => {
      revealAnswersRef.current = revealAnswers;
   }, [revealAnswers]);
   useEffect(() => {
      timeLeftRef.current = timeLeft;
   }, [timeLeft]);
   useEffect(() => {
      roleRef.current = role;
   }, [role]);

   const stopRoundTimer = useCallback(() => {
      if (timerRef.current) {
         clearInterval(timerRef.current);
         timerRef.current = null;
      }
   }, []);

   const stopRoundTimeout = useCallback(() => {
      if (roundTimeoutRef.current) {
         clearTimeout(roundTimeoutRef.current);
         roundTimeoutRef.current = null;
      }
   }, []);

   const cleanUpIntervals = useCallback(() => {
      stopRoundTimer();
      stopRoundTimeout();
   }, [stopRoundTimer, stopRoundTimeout]);

   useEffect(() => {
      if (!isActive) {
         cleanUpIntervals();
      }
   }, [isActive, cleanUpIntervals]);

   useEffect(() => {
      if (!isActive) return;
      if (!matchId) {
         if (matchChannelRef.current) {
            console.log("[WordUp Logs] Cleaning up match channel because matchId is null");
            supabase.removeChannel(matchChannelRef.current);
            matchChannelRef.current = null;
         }
         setRematchState("idle");
      }
   }, [matchId, isActive]);

   const endGame = useCallback(
      async (match: any) => {
         try {
            console.log("[WordUp Logs] endGame: Pushing final consolidated match state to DB...");
            await wordupNetworkGate.enqueue(
               'put',
               'finalize match scores and completed status',
               () => fetchWithRetry(
                  async () => {
                     const { error } = await supabase
                        .from("wordup_matches")
                        .update({
                           status: "completed",
                           p1_answers: match.p1_answers,
                           p2_answers: match.p2_answers,
                           p1_score: match.p1_score,
                           p2_score: match.p2_score,
                           p1_answered: true,
                           p2_answered: true,
                           completed_at: new Date().toISOString(),
                        })
                        .eq("id", match.id);
                     if (error) throw error;
                  },
                  3,
                  1000,
               ),
               true
            );
            console.log("[WordUp Logs] Final sync successful.");
            safeSessionStorage.setItem("wordup_completed_" + match.id, "true");
            safeLocalStorage.removeItem("wordup_active_game");
         } catch (e) {
            console.error("[WordUp Logs] Failed to finalize match in DB:", e);
            triggerToast("Failed to save final results. Check connection.", 5000);
         }
      },
      [triggerToast],
   );

   const advanceRound = useCallback(
      async (_mId: string, nextIdx: number) => {
         if (isAdvancingRef.current) return;
         isAdvancingRef.current = true;

         const nextQ = questionsRef.current[nextIdx];
         const nextDur = nextQ ? getQuestionDuration(nextQ.type) : 10.0;

         matchChannelRef.current?.send({
            type: "broadcast",
            event: "advance_round",
            payload: { nextIdx },
         });

         const updatedMatch = {
            ...matchDataRef.current,
            current_question_index: nextIdx,
            p1_answered: false,
            p2_answered: false,
            question_started_at: new Date(getSyncedNow()).toISOString(),
         };

         setMaxTime(nextDur);
         setTimeLeft(nextDur);
         handleMatchUpdateRef.current(updatedMatch);

         isAdvancingRef.current = false;
      },
      [getSyncedNow, setTimeLeft],
   );

   const handleAnswerSelect = useCallback(
      async (choice: string) => {
         if (
            isSubmittingAnswerRef.current ||
            selectedAnswer !== null ||
            revealAnswersRef.current ||
            !matchId ||
            !isActive
         )
            return;

         isSubmittingAnswerRef.current = true;
         setSelectedAnswer(choice);
         stopRoundTimer();

         const q = questionsRef.current[currentIdxRef.current];
         const duration = q ? getQuestionDuration(q.type) : 10.0;
         const elapsed = parseFloat((duration - timeLeftRef.current).toFixed(2));
         const correct = choice === q?.answer;

         console.log(`[WordUp Logs] Live handleAnswerSelect: Choice: "${choice}", Correct: ${correct}, Elapsed: ${elapsed}s`);

         let points = 0;
         if (correct) {
            const speedBonus = Math.max(0, Math.round((1.0 - elapsed / duration) * 50));
            points = 100 + speedBonus;
         }

         if (currentIdxRef.current === 6) {
            points = points * 2;
         }

         if (choice !== "") {
            if (correct) wordupAudio.playCorrect();
            else wordupAudio.playIncorrect();
         }

         const submission = {
            question_idx: currentIdxRef.current,
            correct,
            time_taken: elapsed,
            points,
            choice,
         };

         try {
            const latestMatch = matchDataRef.current;
            if (!latestMatch) throw new Error("Match data not found");

            const isP1 = roleRef.current === "player1";
            const answers = [...(isP1 ? latestMatch.p1_answers : latestMatch.p2_answers || [])];
            answers.push(submission);
            const newScore = (isP1 ? latestMatch.p1_score : latestMatch.p2_score || 0) + points;

            const updatedMatch = {
               ...latestMatch,
               [isP1 ? "p1_answers" : "p2_answers"]: answers,
               [isP1 ? "p1_answered" : "p2_answered"]: true,
               [isP1 ? "p1_score" : "p2_score"]: newScore,
            };

            handleMatchUpdateRef.current(updatedMatch);

            matchChannelRef.current?.send({
               type: "broadcast",
               event: "player_answered",
               payload: {
                  role: roleRef.current,
                  answers: answers,
                  score: newScore,
               },
            });
         } catch (err) {
            console.error("[WordUp Logs] Local update failed:", err);
         } finally {
            isSubmittingAnswerRef.current = false;
         }
      },
      [matchId, stopRoundTimer, setSelectedAnswer, selectedAnswer, isActive],
   );

   useEffect(() => {
      handleAnswerSelectRef.current = handleAnswerSelect;
   }, [handleAnswerSelect]);

   const startQuestionRound = useCallback(
      (_match: any, index: number) => {
         if (!isActive) return;

         if (currentIdxRef.current === index && timerRef.current !== null) {
            console.log(`[WordUp Logs] Live startQuestionRound: Round ${index + 1} is already active with a running timer. Skipping duplicate init.`);
            return;
         }

         console.log(`[WordUp Logs] Live startQuestionRound: Initiating round ${index + 1} (idx: ${index})`);
         
         currentIdxRef.current = index;

          cleanUpIntervals();

          const q = questionsRef.current[index];
          const duration = q ? getQuestionDuration(q.type) : 10.0;

          setMaxTime(duration);
          setTimeLeft(duration);
          setCurrentIdx(index);
          setSelectedAnswer(null);
          setRevealAnswers(false);
          isSubmittingAnswerRef.current = false;

          const startTime = getSyncedNow();
          let lastTicked = Math.ceil(duration) + 1;

          timerRef.current = window.setInterval(() => {
             if (!isActive) {
                stopRoundTimer();
                return;
             }
             const now = getSyncedNow();
             const elapsed = (now - startTime) / 1000;
             const remaining = Math.max(0, duration - elapsed);

             setTimeLeft(parseFloat(remaining.toFixed(2)));

            const currentSec = Math.ceil(remaining);
            if (remaining <= 3.0 && currentSec < lastTicked) {
               lastTicked = currentSec;
               wordupAudio.playTicking();
            }

            if (remaining <= 0) {
               console.log(`[WordUp Logs] Live Timer expired for round ${index + 1}`);
               stopRoundTimer();
               const latestSelected = useWordUpStore.getState().selectedAnswer;
               if (latestSelected === null) {
                  handleAnswerSelectRef.current("");
               }
            }
         }, 50);
      },
      [cleanUpIntervals, stopRoundTimer, getSyncedNow, handleAnswerSelect, setCurrentIdx, setSelectedAnswer, setRevealAnswers, setTimeLeft, isActive],
   );

   const handleMatchUpdate = useCallback(
      (newMatch: any) => {
         if (!isActive) return;
         const currentMatch = matchDataRef.current;
         const mergedMatch = { ...currentMatch, ...newMatch };

         if (currentMatch) {
            if ((currentMatch.p1_answers?.length || 0) > (newMatch.p1_answers?.length || 0)) {
               mergedMatch.p1_answers = currentMatch.p1_answers;
               mergedMatch.p1_score = currentMatch.p1_score;
               mergedMatch.p1_answered = currentMatch.p1_answered;
            }
            if ((currentMatch.p2_answers?.length || 0) > (newMatch.p2_answers?.length || 0)) {
               mergedMatch.p2_answers = currentMatch.p2_answers;
               mergedMatch.p2_score = currentMatch.p2_score;
               mergedMatch.p2_answered = currentMatch.p2_answered;
            }
            mergedMatch.current_question_index = Math.max(
               currentMatch.current_question_index || 0,
               newMatch.current_question_index || 0,
            );
            if (currentMatch.status === "active" && newMatch.status === "countdown") {
               mergedMatch.status = "active";
            }
         }

         console.log(`[WordUp Logs] Live handleMatchUpdate: Merged state index: ${mergedMatch.current_question_index}, status: ${mergedMatch.status}`);
         setMatchData(mergedMatch);

         const bothAnswered = mergedMatch.p1_answered && mergedMatch.p2_answered;
         const shouldReveal = bothAnswered && !revealAnswersRef.current && !isRevealingRef.current;

         if (shouldReveal) {
            isRevealingRef.current = true;
            console.log(`[WordUp Logs] Live Revealing answers...`);

            stopRoundTimer();
            setRevealAnswers(true);

            const nextIdx = mergedMatch.current_question_index + 1;
            if (nextIdx === 6) {
               triggerToast("⚡ FINAL ROUND: DOUBLE POINTS! ⚡", 3000);
            }

            roundTimeoutRef.current = window.setTimeout(
               async () => {
                  isRevealingRef.current = false;
                  roundTimeoutRef.current = null;
                  if (nextIdx >= 7) {
                     useWordUpStore.getState().setView("loading");
                     endGame(mergedMatch);
                  } else {
                     advanceRound(mergedMatch.id, nextIdx);
                  }
               },
               nextIdx === 6 ? 3200 : 1800,
            );
         }

         if (
            mergedMatch.current_question_index !== currentIdxRef.current &&
            (mergedMatch.status === "active" || mergedMatch.status === "countdown")
         ) {
            startQuestionRound(mergedMatch, mergedMatch.current_question_index);
         }

         if (mergedMatch.status === "completed") {
            safeSessionStorage.setItem("wordup_completed_" + mergedMatch.id, "true");
            setShowRematchButton(true);
            setTimeout(() => {
               setShowRematchButton(false);
            }, 120000);
            onGameOver(mergedMatch);
         }
      },
      [endGame, advanceRound, startQuestionRound, onGameOver, stopRoundTimer, setMatchData, setRevealAnswers, triggerToast, isActive],
   );

   const acceptRematch = useCallback(
      async (onMatchFoundCallback: (newMatchId: string, role: "player1" | "player2") => void) => {
         const match = matchDataRef.current;
         if (!match || !matchChannelRef.current) return;

         if (rematchTimerRef.current) clearInterval(rematchTimerRef.current);

         try {
            console.log("[WordUp Logs] Accepting rematch, creating new match...");

            const newMatch = await wordupNetworkGate.enqueue(
               "post",
               "create rematch match row",
               async () => {
                  const { data, error } = await supabase
                     .from("wordup_matches")
                     .insert({
                        category: match.category,
                        player1_id: match.player1_id,
                        player2_id: match.player2_id,
                        status: "countdown",
                        game_type: "live",
                        question_started_at: new Date(getSyncedNow()).toISOString(),
                     })
                     .select()
                     .single();
                  if (error) throw error;
                  return data;
               },
               true
            );

            if (!newMatch) throw new Error("Failed to create rematch");

            // Generate questions (edge function for procedural, local for legacy)
            await generateMatchQuestions(newMatch.id, match.category);

            matchChannelRef.current.send({
               type: "broadcast",
               event: "rematch_accepted",
               payload: { newMatchId: newMatch.id },
            });

            const myRole = roleRef.current || "player1";
            onMatchFoundCallback(newMatch.id, myRole);
         } catch (e) {
            console.error("[WordUp Logs] Failed to accept rematch:", e);
            triggerToast("Failed to initiate rematch.", 4000);
         }
      },
      [getSyncedNow, triggerToast],
   );

   useEffect(() => {
      if (!isActive || !matchId || matchData?.status === "completed") {
         return;
      }
      const activeState = {
         matchId,
         role,
         questions,
         currentIdx,
         matchData,
         opponentStats,
         revealAnswers,
         selectedAnswer,
         gameType: "live"
      };
      safeLocalStorage.setItem("wordup_active_game", JSON.stringify(activeState));
   }, [isActive, matchId, role, questions, currentIdx, matchData, opponentStats, revealAnswers, selectedAnswer]);

   useEffect(() => {
      handleMatchUpdateRef.current = handleMatchUpdate;
   }, [handleMatchUpdate]);

   const loadAndSubscribeMatch = useCallback(
      async (mId: string, activeRole: "player1" | "player2") => {
         let match;
         try {
            match = await wordupNetworkGate.enqueue(
               "get",
               `load match details for ID ${mId}`,
               async () => {
                  const { data, error } = await supabase
                     .from("wordup_matches")
                     .select("*")
                     .eq("id", mId)
                     .single();
                  if (error) throw error;
                  return data;
               }
            );
         } catch (error) {
            console.error("Error loading match:", error);
            return null;
         }

         if (match.status === "completed" || safeSessionStorage.getItem("wordup_completed_" + mId) === "true") {
            safeSessionStorage.setItem("wordup_completed_" + mId, "true");
            triggerToast("This match has already been completed.", 4000);
            useWordUpStore.getState().resetGame();
            return null;
         }

         const matchTime = match.created_at ? new Date(match.created_at).getTime() : 0;
         const nowTime = new Date().getTime();
         const isExpired = match.status !== "completed" && match.status !== "waiting" && nowTime - matchTime > 5 * 60 * 1000;

         if (isExpired) {
            await wordupNetworkGate.enqueue(
               "put",
               `expire match ID ${mId}`,
               async () => {
                  const { error } = await supabase
                     .from("wordup_matches")
                     .update({
                        status: "completed",
                        completed_at: new Date().toISOString(),
                     })
                     .eq("id", mId);
                  if (error) throw error;
               },
               true
            );
            triggerToast("This match invitation has expired (older than 5 minutes).", 5000);
            useWordUpStore.getState().resetGame();
            return null;
         }

         setMatchData(match);

          try {
             const dec = await decryptMatchQuestions(match);
             setQuestions(dec);
          } catch (e) {
             console.error("Decrypt failed:", e);
          }

         const oppId = activeRole === "player1" ? match.player2_id : match.player1_id;
         if (oppId) {
            const mainProf = await wordupNetworkGate.enqueue(
               "get",
               `load main profile for opponent ${oppId}`,
               async () => {
                  const { data, error } = await supabase
                     .from("profiles")
                     .select("username, avatar_url")
                     .eq("id", oppId)
                     .single();
                  if (error) throw error;
                  return data;
               }
            ).catch(e => {
               console.warn("Failed to load main profile for opponent:", e);
               return null;
            });

            const oppProf = await wordupNetworkGate.enqueue(
               "get",
               `load wordup profile for opponent ${oppId}`,
               async () => {
                  const { data, error } = await supabase
                     .from("wordup_profiles")
                     .select("*")
                     .eq("id", oppId)
                     .single();
                  if (error) throw error;
                  return data;
               }
            ).catch(e => {
               console.warn("Failed to load wordup profile for opponent:", e);
               return null;
            });

            if (oppProf) {
               setOpponentStats({
                  ...oppProf,
                  username: mainProf?.username || "Opponent",
                  avatar_url: mainProf?.avatar_url || null,
               });
            }
         }

         if (matchChannelRef.current) {
            supabase.removeChannel(matchChannelRef.current);
         }

         const chan = supabase
            .channel(`wordup_match_${mId}`, {
               config: {
                  broadcast: { self: false },
               },
            })
            .on(
               "postgres_changes",
               {
                  event: "UPDATE",
                  schema: "public",
                  table: "wordup_matches",
                  filter: `id=eq.${mId}`,
               },
               (payload) => {
                  console.log("[WordUp Logs] Live Postgres Update received:", payload.new.current_question_index);
                  handleMatchUpdateRef.current(payload.new);
               },
            )
            .on("broadcast", { event: "player_answered" }, ({ payload }) => {
               const currentMatch = matchDataRef.current;
               if (!currentMatch) return;

               const updatedMatch = { ...currentMatch };
               if (payload.role === "player1") {
                  updatedMatch.p1_answered = true;
                  updatedMatch.p1_answers = payload.answers;
                  updatedMatch.p1_score = payload.score;
               } else {
                  updatedMatch.p2_answered = true;
                  updatedMatch.p2_answers = payload.answers;
                  updatedMatch.p2_score = payload.score;
               }
               handleMatchUpdateRef.current(updatedMatch);
            })
            .on("broadcast", { event: "advance_round" }, ({ payload }) => {
               const currentMatch = matchDataRef.current;
               if (!currentMatch) return;

               const updatedMatch = {
                  ...currentMatch,
                  current_question_index: payload.nextIdx,
                  p1_answered: false,
                  p2_answered: false,
               };
               handleMatchUpdateRef.current(updatedMatch);
            })
            .on("broadcast", { event: "game_active" }, () => {
               const currentMatch = matchDataRef.current;
               if (!currentMatch) return;
               handleMatchUpdateRef.current({
                  ...currentMatch,
                  status: "active",
               });
            })
            .on("broadcast", { event: "rematch_request" }, () => {
               const currentView = useWordUpStore.getState().view;
               if (currentView !== "gameover") return;

               if (rematchStateRef.current === "sent") {
                  const latestMatch = matchDataRef.current;
                  if (latestMatch) {
                     const myId = activeRole === "player1" ? latestMatch.player1_id : latestMatch.player2_id;
                     const oppId = activeRole === "player1" ? latestMatch.player2_id : latestMatch.player1_id;
                     if (myId && oppId) {
                        if (myId < oppId) {
                           acceptRematch(onRematchAcceptedRef.current);
                        }
                     }
                  }
                  return;
               }

               setRematchState("received");
               setRematchCountdown(20);

               if (rematchTimerRef.current) clearInterval(rematchTimerRef.current);
               let count = 20;
               rematchTimerRef.current = window.setInterval(() => {
                  count--;
                  if (count <= 0) {
                     if (rematchTimerRef.current) clearInterval(rematchTimerRef.current);
                     setRematchState("expired");
                  } else {
                     setRematchCountdown(count);
                  }
               }, 1000);
            })
            .on("broadcast", { event: "rematch_accepted" }, ({ payload }) => {
               if (rematchTimerRef.current) clearInterval(rematchTimerRef.current);

               const currentView = useWordUpStore.getState().view;
               if (currentView !== "gameover" || rematchStateRef.current === "expired") return;

               setRematchState("idle");
               const myRole = roleRef.current || "player1";
               onRematchAcceptedRef.current?.(payload.newMatchId, myRole);
            })
            .on("broadcast", { event: "quick_chat" }, ({ payload }) => {
               window.dispatchEvent(new CustomEvent("wordup-quick-chat", { detail: payload }));
            })
            .subscribe();

         matchChannelRef.current = chan;
         return match;
      },
      [setMatchData, setQuestions, setOpponentStats, triggerToast, acceptRematch],
   );

   // Live watchdog
   useEffect(() => {
      if (!isActive) return;
      if (timeLeft === 0 && !revealAnswers && matchData?.status === "active") {
         const watchdog = setTimeout(() => {
            const current = matchDataRef.current;
            if (current && !revealAnswersRef.current) {
               console.log("[WordUp Logs] Live Watchdog: Round timer expired. Forcing progression...");
               const forcedState = { ...current };
               if (!forcedState.p1_answered) {
                  forcedState.p1_answered = true;
                  forcedState.p1_answers = [...(forcedState.p1_answers || [])];
                  if (forcedState.p1_answers.length <= currentIdxRef.current) {
                     forcedState.p1_answers.push({
                        question_idx: currentIdxRef.current,
                        correct: false,
                        time_taken: maxTime,
                        points: 0,
                     });
                  }
               }
               if (!forcedState.p2_answered) {
                  forcedState.p2_answered = true;
                  forcedState.p2_answers = [...(forcedState.p2_answers || [])];
                  if (forcedState.p2_answers.length <= currentIdxRef.current) {
                     forcedState.p2_answers.push({
                        question_idx: currentIdxRef.current,
                        correct: false,
                        time_taken: maxTime,
                        points: 0,
                     });
                  }
               }
               handleMatchUpdate(forcedState);
            }
         }, 1500);
         return () => clearTimeout(watchdog);
      }
   }, [timeLeft, revealAnswers, matchData?.status, handleMatchUpdate, maxTime, isActive]);

   const sendRematch = useCallback(() => {
      const match = matchDataRef.current;
      if (!match || !matchChannelRef.current) return;

      console.log("[WordUp Logs] Sending live rematch request to peer...");
      setRematchState("sent");
      setRematchCountdown(20);

      matchChannelRef.current.send({
         type: "broadcast",
         event: "rematch_request",
         payload: {},
      });

      if (rematchTimerRef.current) clearInterval(rematchTimerRef.current);
      let count = 20;
      rematchTimerRef.current = window.setInterval(() => {
         count--;
         if (count <= 0) {
            if (rematchTimerRef.current) clearInterval(rematchTimerRef.current);
            setRematchState("expired");
         } else {
            setRematchCountdown(count);
         }
      }, 1000);
   }, []);

   const sendQuickChat = useCallback((text: string) => {
      if (!matchChannelRef.current) return;
      matchChannelRef.current.send({
         type: "broadcast",
         event: "quick_chat",
         payload: { text, senderRole: roleRef.current }
      });
      window.dispatchEvent(new CustomEvent("wordup-quick-chat", {
         detail: { text, senderRole: roleRef.current }
      }));
   }, []);

   useEffect(() => {
      return () => {
         cleanUpIntervals();
         if (rematchTimerRef.current) clearInterval(rematchTimerRef.current);
         if (matchChannelRef.current) {
            supabase.removeChannel(matchChannelRef.current);
         }
      };
   }, [cleanUpIntervals]);

   return {
      matchChannelRef,
      maxTime,
      handleAnswerSelect,
      startQuestionRound,
      cleanUpIntervals,
      rematchState,
      rematchCountdown,
      showRematchButton,
      sendRematch,
      acceptRematch,
      sendQuickChat,
      loadAndSubscribeMatch,
   };
};
