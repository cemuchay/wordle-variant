/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useCallback, useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { fetchWithRetry } from "../../../../utils/fetchWithRetry";
import { wordupAudio } from "../../../../utils/wordupAudio";
import {
   decryptQuestions,
   simulateBotResponse,
} from "../../../../utils/wordupQuestionGenerator";
import { useWordUpStore } from "../../../../store/useWordUpStore";

export const getQuestionDuration = (type: string): number => {
   switch (type) {
      case "real_fake":
      case "length":
      case "missing_letter":
         return 8;
      case "definition":
      case "anagram":
      case "pattern":
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

   const timerRef = useRef<number | null>(null);
   const botTimerRef = useRef<number | null>(null);
   const botActionRef = useRef<any>(null);
   const isSubmittingAnswerRef = useRef(false);
   const isAdvancingRef = useRef(false);
   const isRevealingRef = useRef(false);
   const matchChannelRef = useRef<any>(null);

   const currentIdxRef = useRef(currentIdx);
   const matchDataRef = useRef(matchData);
   const questionsRef = useRef(questions);
   const revealAnswersRef = useRef(revealAnswers);
   const timeLeftRef = useRef(timeLeft);
   const roleRef = useRef(role);
   const handleMatchUpdateRef = useRef<(newMatch: any) => void>(null as any);

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

   const endGame = useCallback(async (match: any) => {
      try {
         console.log("[WordUp Logs] endGame: Completing match status...");
         await fetchWithRetry(
            async () => {
               const { error } = await supabase
                  .from("wordup_matches")
                  .update({
                     status: "completed",
                     completed_at: new Date().toISOString(),
                  })
                  .eq("id", match.id);
               if (error) throw error;
            },
            3,
            1000,
         );
      } catch (e) {
         console.error("[WordUp Logs] Failed to complete match status:", e);
      }
   }, []);

   const advanceRound = useCallback(
      async (mId: string, nextIdx: number) => {
         if (isAdvancingRef.current) return;
         isAdvancingRef.current = true;

         // Optimistic duration for the next round
         const nextQ = questionsRef.current[nextIdx];
         const nextDur = nextQ ? getQuestionDuration(nextQ.type) : 10.0;

         // Optimistic broadcast
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

         // Reset timer state immediately to avoid stuttering
         setMaxTime(nextDur);
         setTimeLeft(nextDur);
         handleMatchUpdateRef.current(updatedMatch);

         try {
            console.log(
               `[WordUp Logs] advanceRound: Advancing DB to index ${nextIdx}`,
            );
            await fetchWithRetry(
               async () => {
                  const { data: curr, error: fetchErr } = await supabase
                     .from("wordup_matches")
                     .select("current_question_index")
                     .eq("id", mId)
                     .single();

                  if (
                     !fetchErr &&
                     curr &&
                     curr.current_question_index >= nextIdx
                  ) {
                     return;
                  }

                  const { error } = await supabase
                     .from("wordup_matches")
                     .update({
                        current_question_index: nextIdx,
                        p1_answered: false,
                        p2_answered: false,
                        question_started_at: updatedMatch.question_started_at,
                     })
                     .eq("id", mId);
                  if (error) throw error;
               },
               3,
               500,
            );
         } catch (e) {
            console.error("[WordUp Logs] Failed to advance round in DB:", e);
         } finally {
            isAdvancingRef.current = false;
         }
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

         if (choice !== "") {
            if (correct) wordupAudio.playCorrect();
            else wordupAudio.playIncorrect();
         }

         const submission = {
            question_idx: currentIdxRef.current,
            correct,
            time_taken: elapsed,
            points,
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

               const p1Answers = [...(latestMatch.p1_answers || [])];
               const p2Answers = [...(latestMatch.p2_answers || [])];
               p1Answers.push(submission);
               p2Answers.push({
                  question_idx: currentIdxRef.current,
                  correct: botAction?.correct,
                  time_taken: botAction?.time_taken,
                  points: botPoints,
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

               fetchWithRetry(
                  async () => {
                     const { error } = await supabase
                        .from("wordup_matches")
                        .update({
                           p1_answers: updatedMatch.p1_answers,
                           p1_answered: true,
                           p1_score: updatedMatch.p1_score,
                           p2_answers: updatedMatch.p2_answers,
                           p2_answered: true,
                           p2_score: updatedMatch.p2_score,
                        })
                        .eq("id", matchId);
                     if (error) throw error;
                  },
                  3,
                  500,
               );
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

               handleMatchUpdateRef.current(updatedMatch);

               matchChannelRef.current?.send({
                  type: "broadcast",
                  event: "player_answered",
                  payload: {
                     role: roleRef.current,
                     [isP1 ? "p1_answers" : "p2_answers"]: answers,
                     [isP1 ? "p1_score" : "p2_score"]: newScore,
                  },
               });

               fetchWithRetry(
                  async () => {
                     const { error } = await supabase
                        .from("wordup_matches")
                        .update({
                           [isP1 ? "p1_answers" : "p2_answers"]: answers,
                           [isP1 ? "p1_answered" : "p2_answered"]: true,
                           [isP1 ? "p1_score" : "p2_score"]: newScore,
                        })
                        .eq("id", matchId);
                     if (error) throw error;
                  },
                  3,
                  500,
               );
            }
         } catch (err) {
            console.error("[WordUp Logs] Sync failed:", err);
            triggerToast("Sync error. Recovering...", 3000);
            isSubmittingAnswerRef.current = false;
         }
      },
      [
         matchId,
         stopRoundTimer,
         triggerToast,
         setSelectedAnswer,
         selectedAnswer,
      ],
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
         console.log(
            `[WordUp Logs] handleMatchUpdate: Received UPDATE. Match index: ${newMatch.current_question_index}, local index: ${currentIdxRef.current}, p1_answered: ${newMatch.p1_answered}, p2_answered: ${newMatch.p2_answered}, status: ${newMatch.status}`,
         );
         setMatchData(newMatch);

         const bothAnswered = newMatch.p1_answered && newMatch.p2_answered;

         if (
            bothAnswered &&
            !revealAnswersRef.current &&
            !isRevealingRef.current
         ) {
            isRevealingRef.current = true;
            console.log(
               "[WordUp Logs] Both players answered. Revealing answers...",
            );

            stopRoundTimer();
            stopBotTimer();
            setRevealAnswers(true);

            setTimeout(() => {
               isRevealingRef.current = false;
               const nextIdx = newMatch.current_question_index + 1;
               if (nextIdx >= 7) {
                  console.log(
                     "[WordUp Logs] Reached end of 7 rounds. Ending match...",
                  );
                  endGame(newMatch);
               } else if (
                  roleRef.current === "player2" ||
                  newMatch.is_bot_match
               ) {
                  console.log(
                     `[WordUp Logs] Triggering advance to index ${nextIdx}...`,
                  );
                  advanceRound(newMatch.id, nextIdx);
               }
            }, 1800);
         }

         if (
            newMatch.current_question_index !== currentIdxRef.current &&
            (newMatch.status === "active" || newMatch.status === "countdown")
         ) {
            console.log(
               `[WordUp Logs] Transitioning round: ${currentIdxRef.current} -> ${newMatch.current_question_index}`,
            );
            startQuestionRound(newMatch, newMatch.current_question_index);
         }

         if (newMatch.status === "completed") {
            console.log("[WordUp Logs] Match marked as completed.");
            onGameOver(newMatch);
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
      ],
   );

   useEffect(() => {
      handleMatchUpdateRef.current = handleMatchUpdate;
   }, [handleMatchUpdate]);

   const loadAndSubscribeMatch = useCallback(
      async (mId: string, activeRole: "player1" | "player2") => {
         const { data: match, error } = await supabase
            .from("wordup_matches")
            .select("*")
            .eq("id", mId)
            .single();

         if (error || !match) {
            console.error("Error loading match:", error);
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
            const { data: oppProf } = await supabase
               .from("wordup_profiles")
               .select("*")
               .eq("id", oppId)
               .single();
            if (oppProf) setOpponentStats(oppProf);
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
                  updatedMatch.p1_answers = payload.p1_answers;
                  updatedMatch.p1_score = payload.p1_score;
               } else {
                  updatedMatch.p2_answered = true;
                  updatedMatch.p2_answers = payload.p2_answers;
                  updatedMatch.p2_score = payload.p2_score;
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
            .subscribe();

         matchChannelRef.current = chan;
         return match;
      },
      [setMatchData, setQuestions, setOpponentStats],
   );

   useEffect(() => {
      return () => {
         cleanUpIntervals();
         if (matchChannelRef.current) {
            supabase.removeChannel(matchChannelRef.current);
         }
      };
   }, [cleanUpIntervals]);

   return {
      matchData,
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
   };
};
