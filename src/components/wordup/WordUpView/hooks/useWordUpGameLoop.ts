/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useCallback, useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { fetchWithRetry } from "../../../../utils/fetchWithRetry";
import { wordupAudio } from "../../../../utils/wordupAudio";
import {
   decryptQuestions,
   simulateBotResponse,
   generateWordUpQuestions,
   generateSecretKey,
   encryptQuestions,
} from "../../../../utils/wordupQuestionGenerator";
import { useWordUpStore } from "../../../../store/useWordUpStore";
import { safeSessionStorage } from "../../../../utils/storage";
import { wordupNetworkGate } from "../services/wordupNetworkGate";

export const getQuestionDuration = (type: string): number => {
   switch (type) {
      case "real_fake":
      case "length":
      case "missing_letter":
         return 8;
      case "definition":
      case "anagram":
      case "anagram_scrambled":
      case "pattern":
      case "math":
      case "odd_one_out":
         return 12;
      case "reverse_wordle":
         return 15;
      default:
         return 10;
   }
};

export const useWordUpGameLoop = (
   matchId: string | null,
   role: "player1" | "player2" | null,
   getSyncedNow: () => number,
   triggerToast: (msg: string, dur?: number) => void,
   onGameOver: (match: any) => void,
   onRematchAccepted: (newMatchId: string, role: "player1" | "player2") => void,
) => {
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

   const [maxTime, setMaxTime] = useState(10);
   const [rematchState, setRematchState] = useState<
      "idle" | "sent" | "received" | "expired"
   >("idle");
   const [rematchCountdown, setRematchCountdown] = useState(10);
   const [showRematchButton, setShowRematchButton] = useState(true);

   const timerRef = useRef<number | null>(null);
   const botTimerRef = useRef<number | null>(null);
   const botActionRef = useRef<any>(null);
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

   useEffect(() => {
      if (!matchId) {
         if (matchChannelRef.current) {
            console.log(
               "[WordUp Logs] Cleaning up match channel because matchId is null",
            );
            supabase.removeChannel(matchChannelRef.current);
            matchChannelRef.current = null;
         }
         // eslint-disable-next-line react-hooks/set-state-in-effect
         setRematchState("idle");
      }
   }, [matchId]);

   const stopRoundTimer = useCallback(() => {
      if (timerRef.current) {
         clearInterval(timerRef.current);
         timerRef.current = null;
      }
   }, []);

   const stopBotTimer = useCallback(() => {
      if (botTimerRef.current) {
         clearTimeout(botTimerRef.current);
         botTimerRef.current = null;
      }
   }, []);

   const cleanUpIntervals = useCallback(() => {
      stopRoundTimer();
      stopBotTimer();
   }, [stopRoundTimer, stopBotTimer]);

   const endGame = useCallback(
      async (match: any) => {
         try {
            console.log(
               "[WordUp Logs] endGame: Pushing final consolidated match state to DB...",
            );
            // Final atomic push of all answers and scores
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
               true // blocking operation
            );
            console.log("[WordUp Logs] Final sync successful.");
            safeSessionStorage.setItem("wordup_completed_" + match.id, "true");
         } catch (e) {
            console.error("[WordUp Logs] Failed to finalize match in DB:", e);
            triggerToast(
               "Failed to save final results. Check connection.",
               5000,
            );
         }
      },
      [triggerToast],
   );

   const advanceRound = useCallback(
      async (_mId: string, nextIdx: number) => {
         if (isAdvancingRef.current) return;
         isAdvancingRef.current = true;

         // Optimistic duration for the next round
         const nextQ = questionsRef.current[nextIdx];
         const nextDur = nextQ ? getQuestionDuration(nextQ.type) : 10.0;

         // Optimistic broadcast to notify opponent
         matchChannelRef.current?.send({
            type: "broadcast",
            event: "advance_round",
            payload: { nextIdx },
         });

         // Local update to start round immediately
         const updatedMatch = {
            ...matchDataRef.current,
            current_question_index: nextIdx,
            p1_answered: false,
            p2_answered: false,
            question_started_at: new Date(getSyncedNow()).toISOString(),
         };

         // Set timer state and trigger local round start
         setMaxTime(nextDur);
         setTimeLeft(nextDur);
         handleMatchUpdateRef.current(updatedMatch);

         // NO DB UPDATE HERE - Purely local/broadcast
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
            !matchId
         )
            return;

         isSubmittingAnswerRef.current = true;
         setSelectedAnswer(choice);
         stopRoundTimer();

         const q = questionsRef.current[currentIdxRef.current];
         const duration = q ? getQuestionDuration(q.type) : 10.0;
         const elapsed = parseFloat(
            (duration - timeLeftRef.current).toFixed(2),
         );
         const correct = choice === q?.answer;

         console.log(
            `[WordUp Logs] handleAnswerSelect: Choice: "${choice}", Correct: ${correct}, Elapsed: ${elapsed}s`,
         );

         let points = 0;
         if (correct) {
            const speedBonus = Math.max(
               0,
               Math.round((1.0 - elapsed / duration) * 50),
            );
            points = 100 + speedBonus;
         }

         if (currentIdxRef.current === 6) {
            points = points * 2;
            console.log(
               `[WordUp Logs] Final round points doubled! New points: ${points}`,
            );
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

            let updatedMatch = { ...latestMatch };

            if (latestMatch.is_bot_match && roleRef.current === "player1") {
               const botAction = botActionRef.current;
               let botPoints = 0;
               if (botAction?.correct) {
                  const speedBonus = Math.max(
                     0,
                     Math.round((1.0 - botAction.time_taken / duration) * 50),
                  );
                  botPoints = 100 + speedBonus;
               }

               if (currentIdxRef.current === 6) {
                  botPoints = botPoints * 2;
                  console.log(
                     `[WordUp Logs] Bot double points in final round: ${botPoints}`,
                  );
               }

               let botChoice = q?.answer;
               if (!botAction?.correct && q?.choices) {
                  const wrongChoices = q.choices.filter(
                     (c: string) => c !== q.answer,
                  );
                  botChoice =
                     wrongChoices[
                        Math.floor(Math.random() * wrongChoices.length)
                     ] || "WRONG";
               }

               const p1Answers = [...(latestMatch.p1_answers || [])];
               const p2Answers = [...(latestMatch.p2_answers || [])];
               p1Answers.push(submission);
               p2Answers.push({
                  question_idx: currentIdxRef.current,
                  correct: botAction?.correct,
                  time_taken: botAction?.time_taken,
                  points: botPoints,
                  choice: botChoice,
               });

               updatedMatch = {
                  ...latestMatch,
                  p1_answers: p1Answers,
                  p1_answered: true,
                  p1_score: (latestMatch.p1_score || 0) + points,
                  p2_answers: p2Answers,
                  p2_answered: true,
                  p2_score: (latestMatch.p2_score || 0) + botPoints,
               };

               handleMatchUpdateRef.current(updatedMatch);
               // NO DB UPDATE HERE
            } else {
               const isP1 = roleRef.current === "player1";
               const answers = [
                  ...(isP1
                     ? latestMatch.p1_answers
                     : latestMatch.p2_answers || []),
               ];
               answers.push(submission);
               const newScore =
                  (isP1 ? latestMatch.p1_score : latestMatch.p2_score || 0) +
                  points;

               updatedMatch = {
                  ...latestMatch,
                  [isP1 ? "p1_answers" : "p2_answers"]: answers,
                  [isP1 ? "p1_answered" : "p2_answered"]: true,
                  [isP1 ? "p1_score" : "p2_score"]: newScore,
               };

               // Update local state immediately
               handleMatchUpdateRef.current(updatedMatch);

               // Broadcast to peer immediately
               matchChannelRef.current?.send({
                  type: "broadcast",
                  event: "player_answered",
                  payload: {
                     role: roleRef.current,
                     answers: answers,
                     score: newScore,
                  },
               });
               // NO DB UPDATE HERE
            }
         } catch (err) {
            console.error("[WordUp Logs] Local update failed:", err);
         } finally {
            isSubmittingAnswerRef.current = false;
         }
      },
      [matchId, stopRoundTimer, setSelectedAnswer, selectedAnswer],
   );

   const startQuestionRound = useCallback(
      (match: any, index: number) => {
         console.log(
            `[WordUp Logs] startQuestionRound: Initiating round ${index + 1} (idx: ${index})`,
         );

         // Immediately update the ref to prevent multiple transitions
         currentIdxRef.current = index;

         cleanUpIntervals();
         setCurrentIdx(index);
         setSelectedAnswer(null);
         setRevealAnswers(false);

         const q = questionsRef.current[index];
         const duration = q ? getQuestionDuration(q.type) : 10.0;

         setMaxTime(duration);
         setTimeLeft(duration);
         isSubmittingAnswerRef.current = false;

         const startTime = getSyncedNow();

         let lastTicked = Math.ceil(duration) + 1;
         timerRef.current = window.setInterval(() => {
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
               console.log(
                  `[WordUp Logs] Timer expired for round ${index + 1}`,
               );
               stopRoundTimer();
               if (selectedAnswer === null) {
                  handleAnswerSelect("");
               }
            }
         }, 30); // Faster tick for smoother movement

         if (
            match.is_bot_match &&
            roleRef.current === "player1" &&
            questionsRef.current[index]
         ) {
            const q = questionsRef.current[index];
            const botProf = match.bot_profile || "average";
            const botAction = simulateBotResponse(q, botProf);

            // Scale bot action time to fit within the adaptive duration
            const botTime = Math.min(botAction.time_taken, duration - 0.5);
            botActionRef.current = { ...botAction, time_taken: botTime };
            console.log(
               `[WordUp Logs] Bot response pre-calculated (Profile: ${botProf}, Time: ${botTime}s)`,
            );

            botTimerRef.current = window.setTimeout(async () => {
               console.log(
                  `[WordUp Logs] Bot "answered" (local optimistic update)`,
               );
               setMatchData({ ...matchDataRef.current, p2_answered: true });
            }, botTime * 1000);
         }
      },
      [
         cleanUpIntervals,
         stopRoundTimer,
         getSyncedNow,
         handleAnswerSelect,
         setMatchData,
         setCurrentIdx,
         setSelectedAnswer,
         setRevealAnswers,
         setTimeLeft,
         selectedAnswer,
      ],
   );

   const handleMatchUpdate = useCallback(
      (newMatch: any) => {
         const currentMatch = matchDataRef.current;

         // 1. Robust state merging: Only accept updates that represent progress or same state
         // If Postgres update is older than local state (e.g. local has more answers), merge them.
         const mergedMatch = { ...currentMatch, ...newMatch };

         if (currentMatch) {
            // Ensure we don't lose answers that we already know about locally
            if (
               (currentMatch.p1_answers?.length || 0) >
               (newMatch.p1_answers?.length || 0)
            ) {
               mergedMatch.p1_answers = currentMatch.p1_answers;
               mergedMatch.p1_score = currentMatch.p1_score;
               mergedMatch.p1_answered = currentMatch.p1_answered;
            }
            if (
               (currentMatch.p2_answers?.length || 0) >
               (newMatch.p2_answers?.length || 0)
            ) {
               mergedMatch.p2_answers = currentMatch.p2_answers;
               mergedMatch.p2_score = currentMatch.p2_score;
               mergedMatch.p2_answered = currentMatch.p2_answered;
            }
            // Keep the highest question index
            mergedMatch.current_question_index = Math.max(
               currentMatch.current_question_index || 0,
               newMatch.current_question_index || 0,
            );

            // If local status is already active/completed, don't let it go back to countdown
            if (
               currentMatch.status === "active" &&
               newMatch.status === "countdown"
            ) {
               mergedMatch.status = "active";
            }
         }

         console.log(
            `[WordUp Logs] handleMatchUpdate: Merged state index: ${mergedMatch.current_question_index}, status: ${mergedMatch.status}`,
         );
         setMatchData(mergedMatch);

         const isAsync = mergedMatch.status === "waiting";
         const isP1 = roleRef.current === "player1";
         const myAnsweredThisRound = isP1 ? mergedMatch.p1_answered : mergedMatch.p2_answered;
         const bothAnswered = mergedMatch.p1_answered && mergedMatch.p2_answered;

         const shouldReveal = isAsync
            ? (myAnsweredThisRound && !revealAnswersRef.current && !isRevealingRef.current)
            : (bothAnswered && !revealAnswersRef.current && !isRevealingRef.current);

         if (shouldReveal) {
            isRevealingRef.current = true;
            console.log(
               `[WordUp Logs] Revealing answers (Async: ${isAsync})...`
            );

            stopRoundTimer();
            stopBotTimer();
            setRevealAnswers(true);

            const nextIdx = mergedMatch.current_question_index + 1;
            if (nextIdx === 6) {
               triggerToast("⚡ FINAL ROUND: DOUBLE POINTS! ⚡", 3000);
            }

            setTimeout(
               async () => {
                  isRevealingRef.current = false;
                  if (nextIdx >= 7) {
                     console.log(
                        "[WordUp Logs] Reached end of 7 rounds. Ending match...",
                     );
                     if (isAsync) {
                        // Check if opponent already played all 7 rounds
                        const oppAnswers = isP1 ? mergedMatch.p2_answers : mergedMatch.p1_answers;
                        const oppCompleted = oppAnswers && oppAnswers.length === 7;

                        if (oppCompleted) {
                           // Both have now played! Finalize match as completed
                           endGame(mergedMatch);
                        } else {
                           // Opponent hasn't played yet. Save our progress in database and exit.
                           try {
                              await wordupNetworkGate.enqueue(
                                 'put',
                                 'submit async turn answers and score',
                                 async () => {
                                    const { error } = await supabase
                                       .from("wordup_matches")
                                       .update({
                                          p1_answers: mergedMatch.p1_answers,
                                          p2_answers: mergedMatch.p2_answers,
                                          p1_score: mergedMatch.p1_score,
                                          p2_score: mergedMatch.p2_score,
                                          p1_answered: isP1 ? true : mergedMatch.p1_answered,
                                          p2_answered: !isP1 ? true : mergedMatch.p2_answered,
                                       })
                                       .eq("id", mergedMatch.id);
                                    if (error) throw error;
                                 },
                                 true // blocking operation
                              );
                              triggerToast("Turn submitted! Waiting for opponent.", 5000);
                           } catch (err) {
                              console.error("Failed to save async turn:", err);
                              triggerToast("Failed to save progress.", 4000);
                           }
                           useWordUpStore.getState().resetGame();
                        }
                     } else {
                        endGame(mergedMatch);
                     }
                  } else {
                     console.log(
                        `[WordUp Logs] Triggering advance to index ${nextIdx}...`,
                     );
                     advanceRound(mergedMatch.id, nextIdx);
                  }
               },
               nextIdx === 6 ? 3200 : 1800,
            );
         }

         if (
            mergedMatch.current_question_index !== currentIdxRef.current &&
            (mergedMatch.status === "active" ||
               mergedMatch.status === "countdown" ||
               mergedMatch.status === "waiting")
         ) {
            console.log(
               `[WordUp Logs] Transitioning round: ${currentIdxRef.current} -> ${mergedMatch.current_question_index}`,
            );
            startQuestionRound(mergedMatch, mergedMatch.current_question_index);
         }

         if (mergedMatch.status === "completed") {
            console.log("[WordUp Logs] Match marked as completed.");
            safeSessionStorage.setItem("wordup_completed_" + mergedMatch.id, "true");
            setShowRematchButton(true);
            setTimeout(() => {
               setShowRematchButton(false);
            }, 120000);
            onGameOver(mergedMatch);
         }
      },
      [
         endGame,
         advanceRound,
         startQuestionRound,
         onGameOver,
         stopRoundTimer,
         stopBotTimer,
         setMatchData,
         setRevealAnswers,
         triggerToast,
      ],
   );

   const acceptRematch = useCallback(
      async (
         onMatchFoundCallback: (
            newMatchId: string,
            role: "player1" | "player2",
         ) => void,
      ) => {
         const match = matchDataRef.current;
         if (!match || !matchChannelRef.current) return;

         if (rematchTimerRef.current) clearInterval(rematchTimerRef.current);

         try {
            console.log(
               "[WordUp Logs] Accepting rematch, generating new game...",
            );
            const rawQuestions = generateWordUpQuestions(match.category);
            const secretKey = generateSecretKey();
            const encryptedStr = encryptQuestions(rawQuestions, secretKey);

            // Create new match row via network gate
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
                        questions: encryptedStr,
                        encryption_key: secretKey,
                        status: "countdown",
                        question_started_at: new Date(getSyncedNow()).toISOString(),
                     })
                     .select()
                     .single();
                  if (error) throw error;
                  return data;
               },
               true // blocking
            );

            if (!newMatch)
               throw new Error("Failed to create rematch");

            console.log(
               "[WordUp Logs] Rematch created successfully, ID:",
               newMatch.id,
            );

            // Broadcast the new match ID
            matchChannelRef.current.send({
               type: "broadcast",
               event: "rematch_accepted",
               payload: { newMatchId: newMatch.id },
            });

            // Transition self
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
            console.log(`[WordUp Logs] Match ${mId} is already completed. Aborting launch.`);
            safeSessionStorage.setItem("wordup_completed_" + mId, "true");
            triggerToast("This match has already been completed.", 4000);
            useWordUpStore.getState().resetGame();
            return null;
         }

         const matchTime = match.created_at
            ? new Date(match.created_at).getTime()
            : 0;
         const nowTime = new Date().getTime();
         const isExpired =
            match.status !== "completed" && nowTime - matchTime > 5 * 60 * 1000;

         if (isExpired) {
            console.log(
               "[WordUp Logs] Match is older than 5 minutes. Expiring match in database...",
            );
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
            triggerToast(
               "This match invitation has expired (older than 5 minutes).",
               5000,
            );
            useWordUpStore.getState().resetGame();
            return null;
         }

         setMatchData(match);

         if (match.questions && match.encryption_key) {
            try {
               const dec = decryptQuestions(
                  match.questions,
                  match.encryption_key,
               );
               setQuestions(dec);
            } catch (e) {
               console.error("Decrypt failed:", e);
            }
         }

         const oppId =
            activeRole === "player1" ? match.player2_id : match.player1_id;
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
         } else if (match.is_bot_match) {
            setOpponentStats({
               rating:
                  match.bot_profile === "impossible"
                     ? 2200
                     : match.bot_profile === "master"
                       ? 1800
                       : 1200,
               xp: 5000,
               games_played: 150,
               games_won: 95,
               games_lost: 50,
               games_tied: 5,
               rank_name:
                  match.bot_profile === "impossible" ? "Diamond" : "Gold",
            } as any);
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
                  console.log(
                     "[WordUp Logs] Postgres Update received:",
                     payload.new.current_question_index,
                  );
                  handleMatchUpdateRef.current(payload.new);
               },
            )
            .on("broadcast", { event: "player_answered" }, ({ payload }) => {
               console.log("[WordUp Logs] Broadcast: player_answered", payload);
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
               console.log("[WordUp Logs] Broadcast: advance_round", payload);
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
               console.log("[WordUp Logs] Broadcast: game_active");
               const currentMatch = matchDataRef.current;
               if (!currentMatch) return;
               handleMatchUpdateRef.current({
                  ...currentMatch,
                  status: "active",
               });
            })
            .on("broadcast", { event: "rematch_request" }, () => {
               console.log("[WordUp Logs] Broadcast: rematch_request received");

               const currentView = useWordUpStore.getState().view;
               if (currentView !== "gameover") {
                  console.log(
                     "[WordUp Logs] Rematch request received but view is not gameover. Ignoring.",
                  );
                  return;
               }

               if (rematchStateRef.current === "sent") {
                  console.log(
                     "[WordUp Logs] Simultaneous rematch requests! Resolving race condition...",
                  );
                  const latestMatch = matchDataRef.current;
                  if (latestMatch) {
                     const myId =
                        activeRole === "player1"
                           ? latestMatch.player1_id
                           : latestMatch.player2_id;
                     const oppId =
                        activeRole === "player1"
                           ? latestMatch.player2_id
                           : latestMatch.player1_id;
                     if (myId && oppId) {
                        if (myId < oppId) {
                           console.log(
                              "[WordUp Logs] I have the lower ID. Automatically accepting and hosting rematch.",
                           );
                           acceptRematch(onRematchAcceptedRef.current);
                        } else {
                           console.log(
                              "[WordUp Logs] I have the higher ID. Waiting for opponent to host and send rematch_accepted.",
                           );
                        }
                     }
                  }
                  return;
               }

               setRematchState("received");
               setRematchCountdown(20);

               if (rematchTimerRef.current)
                  clearInterval(rematchTimerRef.current);
               let count = 20;
               rematchTimerRef.current = window.setInterval(() => {
                  count--;
                  if (count <= 0) {
                     if (rematchTimerRef.current)
                        clearInterval(rematchTimerRef.current);
                     setRematchState("expired");
                  } else {
                     setRematchCountdown(count);
                  }
               }, 1000);
            })
            .on("broadcast", { event: "rematch_accepted" }, ({ payload }) => {
               console.log(
                  "[WordUp Logs] Broadcast: rematch_accepted received, new match ID:",
                  payload.newMatchId,
               );
               if (rematchTimerRef.current)
                  clearInterval(rematchTimerRef.current);

               const currentView = useWordUpStore.getState().view;
               if (
                  currentView !== "gameover" ||
                  rematchStateRef.current === "expired"
               ) {
                  console.log(
                     "[WordUp Logs] Rematch accepted received but view is not gameover or rematch is expired. Ignoring.",
                  );
                  return;
               }

               setRematchState("idle");
               const myRole = roleRef.current || "player1";
               onRematchAcceptedRef.current?.(payload.newMatchId, myRole);
            })
            .on("broadcast", { event: "quick_chat" }, ({ payload }) => {
               console.log("[WordUp Logs] Broadcast: quick_chat", payload);
               window.dispatchEvent(new CustomEvent("wordup-quick-chat", { detail: payload }));
            })
            .subscribe();

         matchChannelRef.current = chan;
         return match;
      },
      [
         setMatchData,
         setQuestions,
         setOpponentStats,
         triggerToast,
         acceptRematch,
      ],
   );

   // Timer expiry watchdog implementation
   useEffect(() => {
      if (timeLeft === 0 && !revealAnswers && matchData?.status === "active") {
         const watchdog = setTimeout(() => {
            const current = matchDataRef.current;
            if (current && !revealAnswersRef.current) {
               console.log(
                  "[WordUp Logs] Watchdog: Round timer expired and opponent silent. Forcing progression...",
               );
               // Force opponent to have "answered" with whatever they have (or empty)
               const forcedState = { ...current };
               if (!forcedState.p1_answered) {
                  forcedState.p1_answered = true;
                  forcedState.p1_answers = [...(forcedState.p1_answers || [])];
                  // Add missed entry if missing
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
         }, 1500); // 1.5s grace period after timer hits 0
         return () => clearTimeout(watchdog);
      }
   }, [timeLeft, revealAnswers, matchData?.status, handleMatchUpdate, maxTime]);

   const sendRematch = useCallback(() => {
      const match = matchDataRef.current;
      if (!match || !matchChannelRef.current) return;

      console.log("[WordUp Logs] Sending rematch request to peer...");
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
      matchData,
      setMatchData,
      matchChannelRef,
      questions,
      currentIdx,
      timeLeft,
      maxTime,
      selectedAnswer,
      revealAnswers,
      opponentStats,
      handleAnswerSelect,
      loadAndSubscribeMatch,
      startQuestionRound,
      cleanUpIntervals,
      rematchState,
      rematchCountdown,
      showRematchButton,
      sendRematch,
      acceptRematch,
      sendQuickChat,
   };
};
