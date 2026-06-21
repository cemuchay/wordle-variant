/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useCallback, useEffect } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { fetchWithRetry } from "../../../../utils/fetchWithRetry";
import { wordupAudio } from "../../../../utils/wordupAudio";
import { decryptMatchQuestions } from "../../../../utils/wordupQuestionGenerator";
import { preloadMatchFlags } from "../../../../utils/wordupQuestionPostProcessor";

import { useWordUpStore } from "../../../../store/useWordUpStore";
import { safeSessionStorage } from "../../../../utils/storage";
import { wordupNetworkGate } from "../services/wordupNetworkGate";
import { getQuestionDuration } from "./useWordUpGameLoop";

export interface AsyncGameProps {
   isActive: boolean;
   matchId: string | null;
   role: "player1" | "player2" | null;
   getSyncedNow: () => number;
   triggerToast: (msg: string, dur?: number) => void;
   onGameOver: (match: any) => void;
}

export const useWordUpAsyncGame = ({
   isActive,
   matchId,
   role,
   getSyncedNow,
   triggerToast,
   onGameOver,
}: AsyncGameProps) => {
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
   const setOpponentStats = useWordUpStore((s) => s.setOpponentStats);
   const maxTime = useWordUpStore((s) => s.maxTime);
   const setMaxTime = useWordUpStore((s) => s.setMaxTime);

   const timerRef = useRef<number | null>(null);
   const roundTimeoutRef = useRef<number | null>(null);
   const isSubmittingAnswerRef = useRef(false);
   const isAdvancingRef = useRef(false);
   const isRevealingRef = useRef(false);

   const currentIdxRef = useRef(currentIdx);
   const matchDataRef = useRef(matchData);
   const questionsRef = useRef(questions);
   const revealAnswersRef = useRef(revealAnswers);
   const timeLeftRef = useRef(timeLeft);
   const roleRef = useRef(role);
   const handleMatchUpdateRef = useRef<(newMatch: any) => void>(null as any);
   const handleAnswerSelectRef = useRef<any>(null);

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

   const endGame = useCallback(
      async (match: any) => {
         try {
            console.log("[WordUp Logs] Async endGame: Pushing final consolidated match state to DB...");
            const completedAt = new Date().toISOString();
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
                           completed_at: completedAt,
                        })
                        .eq("id", match.id);
                     if (error) throw error;
                  },
                  3,
                  1000,
               ),
               true
            );
            console.log("[WordUp Logs] Async Final sync successful.");
            safeSessionStorage.setItem("wordup_completed_" + match.id, "true");

            // Update local state directly so we transition to gameover
            const finalMatch = {
               ...match,
               status: "completed",
               p1_answered: true,
               p2_answered: true,
               completed_at: completedAt,
            };
            setMatchData(finalMatch);
            onGameOver(finalMatch);
         } catch (e) {
            console.error("[WordUp Logs] Failed to finalize match in DB:", e);
            triggerToast("Failed to save final results. Check connection.", 5000);
         }
      },
      [triggerToast, setMatchData, onGameOver],
   );

   const advanceRound = useCallback(
      async (_mId: string, nextIdx: number) => {
         if (isAdvancingRef.current) return;
         isAdvancingRef.current = true;

         const nextQ = questionsRef.current[nextIdx];
         const nextDur = nextQ ? getQuestionDuration(nextQ.type) : 10.0;

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

         console.log(`[WordUp Logs] Async handleAnswerSelect: Choice: "${choice}", Correct: ${correct}, Elapsed: ${elapsed}s`);

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
            console.log(`[WordUp Logs] Async startQuestionRound: Round ${index + 1} is already active with a running timer. Skipping duplicate init.`);
            return;
         }

         console.log(`[WordUp Logs] Async startQuestionRound: Initiating round ${index + 1} (idx: ${index})`);

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
               console.log(`[WordUp Logs] Async Timer expired for round ${index + 1}`);
               stopRoundTimer();
               const latestSelected = useWordUpStore.getState().selectedAnswer;
               if (latestSelected === null) {
                  handleAnswerSelectRef.current("");
               }
            }
         }, 30);
      },
      [cleanUpIntervals, stopRoundTimer, getSyncedNow, setCurrentIdx, setSelectedAnswer, setRevealAnswers, setTimeLeft, isActive],
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
         }

         console.log(`[WordUp Logs] Async handleMatchUpdate: Merged state index: ${mergedMatch.current_question_index}, status: ${mergedMatch.status}`);
         setMatchData(mergedMatch);

         const isP1 = roleRef.current === "player1";
         const myAnsweredThisRound = isP1 ? mergedMatch.p1_answered : mergedMatch.p2_answered;
         const shouldReveal = myAnsweredThisRound && !revealAnswersRef.current && !isRevealingRef.current;

         if (shouldReveal) {
            isRevealingRef.current = true;
            console.log(`[WordUp Logs] Async Revealing answers...`);

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
                     
                     // Check if opponent already played all 7 rounds
                     const oppAnswers = isP1 ? mergedMatch.p2_answers : mergedMatch.p1_answers;
                     const oppCompleted = oppAnswers && oppAnswers.length === 7;

                     if (oppCompleted) {
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
                              true
                           );
                           triggerToast("Turn submitted! Waiting for opponent.", 5000);
                        } catch (err) {
                           console.error("Failed to save async turn:", err);
                           triggerToast("Failed to save progress.", 4000);
                        }
                        useWordUpStore.getState().resetGame();
                     }
                  } else {
                     advanceRound(mergedMatch.id, nextIdx);
                  }
               },
               nextIdx === 6 ? 3200 : 1800,
            );
         }

         if (
            mergedMatch.current_question_index !== currentIdxRef.current &&
            mergedMatch.status === "waiting"
         ) {
            startQuestionRound(mergedMatch, mergedMatch.current_question_index);
         }

         if (mergedMatch.status === "completed") {
            safeSessionStorage.setItem("wordup_completed_" + mergedMatch.id, "true");
            onGameOver(mergedMatch);
         }
      },
      [endGame, advanceRound, startQuestionRound, onGameOver, stopRoundTimer, setMatchData, setRevealAnswers, triggerToast, isActive],
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
               `load async match details for ID ${mId}`,
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
            console.error("Error loading async match:", error);
            return null;
         }

          setMatchData(match);

          // If questions aren't ready yet (edge function may have been called but not completed),
          // poll briefly or generate them on the spot
          if (!match.questions && !match.encrypted_questions) {
             console.log("[WordUp Async] Questions not ready yet, generating now...");
             const { generateMatchQuestions } = await import("../../../../services/wordup/questionService");
             await generateMatchQuestions(match.id, match.category);

             const { data: refreshed } = await supabase
                .from("wordup_matches")
                .select("*")
                .eq("id", match.id)
                .single();

             if (refreshed) {
                match = refreshed;
                setMatchData(match);
             }
          }

          try {
             const dec = await decryptMatchQuestions(match);
             if (match.category === "flag_bearer") {
                await preloadMatchFlags(dec);
             }
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

         return match;
      },
      [setMatchData, setQuestions, setOpponentStats],
   );

   useEffect(() => {
      return () => {
         cleanUpIntervals();
      };
   }, [cleanUpIntervals]);

   return {
      maxTime,
      handleAnswerSelect,
      startQuestionRound,
      cleanUpIntervals,
      loadAndSubscribeMatch,
   };
};
