/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useCallback, useEffect, useState } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { fetchWithRetry } from "../../../../utils/fetchWithRetry";
import { wordupAudio } from "../../../../utils/wordupAudio";
import { decryptQuestions, generateWordUpQuestions, generateSecretKey, encryptQuestions, simulateBotResponse } from "../../../../utils/wordupQuestionGenerator";
import { useWordUpStore } from "../../../../store/useWordUpStore";
import { safeSessionStorage, safeLocalStorage } from "../../../../utils/storage";
import { wordupNetworkGate } from "../services/wordupNetworkGate";
import { getQuestionDuration } from "./useWordUpGameLoop";

export interface BotGameProps {
   isActive: boolean;
   matchId: string | null;
   role: "player1" | "player2" | null;
   getSyncedNow: () => number;
   triggerToast: (msg: string, dur?: number) => void;
   onGameOver: (match: any) => void;
   onRematchAccepted: (newMatchId: string, role: "player1" | "player2") => void;
}

export const useWordUpBotGame = ({
   isActive,
   matchId,
   role,
   getSyncedNow,
   triggerToast,
   onGameOver,
   onRematchAccepted,
}: BotGameProps) => {
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
   const [rematchState, setRematchState] = useState<"idle" | "sent" | "received" | "expired">("idle");
   const [rematchCountdown, setRematchCountdown] = useState(10);
   const [showRematchButton, setShowRematchButton] = useState(true);

   const timerRef = useRef<number | null>(null);
   const botTimerRef = useRef<number | null>(null);
   const roundTimeoutRef = useRef<number | null>(null);
   const botActionRef = useRef<any>(null);
   const isSubmittingAnswerRef = useRef(false);
   const isAdvancingRef = useRef(false);
   const isRevealingRef = useRef(false);
   const rematchTimerRef = useRef<number | null>(null);

   const currentIdxRef = useRef(currentIdx);
   const matchDataRef = useRef(matchData);
   const questionsRef = useRef(questions);
   const revealAnswersRef = useRef(revealAnswers);
   const timeLeftRef = useRef(timeLeft);
   const roleRef = useRef(role);
   const handleMatchUpdateRef = useRef<(newMatch: any) => void>(null as any);
   const onRematchAcceptedRef = useRef(onRematchAccepted);
   const handleAnswerSelectRef = useRef<any>(null);

   useEffect(() => {
      onRematchAcceptedRef.current = onRematchAccepted;
   }, [onRematchAccepted]);

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

   const stopRoundTimeout = useCallback(() => {
      if (roundTimeoutRef.current) {
         clearTimeout(roundTimeoutRef.current);
         roundTimeoutRef.current = null;
      }
   }, []);

   const cleanUpIntervals = useCallback(() => {
      stopRoundTimer();
      stopBotTimer();
      stopRoundTimeout();
   }, [stopRoundTimer, stopBotTimer, stopRoundTimeout]);

   const endGame = useCallback(
      async (match: any) => {
         try {
            console.log("[WordUp Logs] Bot endGame: Pushing final consolidated match state to DB...");
            const completedAt = new Date().toISOString();
            const isLocalBotMatch = match.id.startsWith("bot-match-");
            
            await wordupNetworkGate.enqueue(
               isLocalBotMatch ? 'post' : 'put',
               isLocalBotMatch ? 'create and finalize bot match row' : 'finalize match scores and completed status',
               () => fetchWithRetry(
                  async () => {
                     const matchPayload: any = {
                        category: match.category,
                        player1_id: match.player1_id,
                        player2_id: match.player2_id,
                        is_bot_match: true,
                        game_type: "live-bot",
                        bot_profile: match.bot_profile || "average",
                        status: "completed",
                        p1_answers: match.p1_answers,
                        p2_answers: match.p2_answers,
                        p1_score: match.p1_score,
                        p2_score: match.p2_score,
                        p1_answered: true,
                        p2_answered: true,
                        completed_at: completedAt,
                        questions: match.questions,
                        encryption_key: match.encryption_key
                     };
                     
                     let error;
                     if (isLocalBotMatch) {
                        const { error: insertError } = await supabase
                           .from("wordup_matches")
                           .insert(matchPayload);
                        error = insertError;
                     } else {
                        const { error: updateError } = await supabase
                           .from("wordup_matches")
                           .update(matchPayload)
                           .eq("id", match.id);
                        error = updateError;
                     }
                     if (error) throw error;
                  },
                  3,
                  1000,
               ),
               true
            );
            console.log("[WordUp Logs] Bot Final sync successful.");
            safeSessionStorage.setItem("wordup_completed_" + match.id, "true");
            safeLocalStorage.removeItem("wordup_active_game");

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

         console.log(`[WordUp Logs] Bot handleAnswerSelect: Choice: "${choice}", Correct: ${correct}, Elapsed: ${elapsed}s`);

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

            const botAction = botActionRef.current;
            let botPoints = 0;
            if (botAction?.correct) {
               const speedBonus = Math.max(0, Math.round((1.0 - botAction.time_taken / duration) * 50));
               botPoints = 100 + speedBonus;
            }

            if (currentIdxRef.current === 6) {
               botPoints = botPoints * 2;
            }

            let botChoice = q?.answer;
            if (!botAction?.correct && q?.choices) {
               const wrongChoices = q.choices.filter((c: string) => c !== q.answer);
               botChoice = wrongChoices[Math.floor(Math.random() * wrongChoices.length)] || "WRONG";
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

            const updatedMatch = {
               ...latestMatch,
               p1_answers: p1Answers,
               p1_answered: true,
               p1_score: (latestMatch.p1_score || 0) + points,
               p2_answers: p2Answers,
               p2_answered: true,
               p2_score: (latestMatch.p2_score || 0) + botPoints,
            };

            handleMatchUpdateRef.current(updatedMatch);
         } catch (err) {
            console.error("[WordUp Logs] Local bot update failed:", err);
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
      (match: any, index: number) => {
         if (!isActive) return;

         if (currentIdxRef.current === index && timerRef.current !== null) {
            console.log(`[WordUp Logs] Bot startQuestionRound: Round ${index + 1} is already active with a running timer. Skipping duplicate init.`);
            return;
         }

         console.log(`[WordUp Logs] Bot startQuestionRound: Initiating round ${index + 1} (idx: ${index})`);

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

            setTimeLeft(parseFloat(remaining.toFixed(1)));

            const currentSec = Math.ceil(remaining);
            if (remaining <= 3.0 && currentSec < lastTicked) {
               lastTicked = currentSec;
               wordupAudio.playTicking();
            }

            if (remaining <= 0) {
               console.log(`[WordUp Logs] Bot Timer expired for round ${index + 1}`);
               stopRoundTimer();
               const latestSelected = useWordUpStore.getState().selectedAnswer;
               if (latestSelected === null) {
                  handleAnswerSelectRef.current("");
               }
            }
         }, 100);

         if (match.is_bot_match && roleRef.current === "player1" && questionsRef.current[index]) {
            const botProf = match.bot_profile || "average";
            const botAction = simulateBotResponse(q, botProf);

            const botTime = Math.min(botAction.time_taken, duration - 0.5);
            botActionRef.current = { ...botAction, time_taken: botTime };

            botTimerRef.current = window.setTimeout(async () => {
               setMatchData({ ...matchDataRef.current, p2_answered: true });
            }, botTime * 1000);
         }
      },
      [cleanUpIntervals, stopRoundTimer, getSyncedNow, handleAnswerSelect, setMatchData, setCurrentIdx, setSelectedAnswer, setRevealAnswers, setTimeLeft, selectedAnswer, isActive],
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

         console.log(`[WordUp Logs] Bot handleMatchUpdate: Merged state index: ${mergedMatch.current_question_index}, status: ${mergedMatch.status}`);
         setMatchData(mergedMatch);

         const bothAnswered = mergedMatch.p1_answered && mergedMatch.p2_answered;
         const shouldReveal = bothAnswered && !revealAnswersRef.current && !isRevealingRef.current;

         if (shouldReveal) {
            isRevealingRef.current = true;
            console.log(`[WordUp Logs] Bot Revealing answers...`);

            stopRoundTimer();
            stopBotTimer();
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
      [endGame, advanceRound, startQuestionRound, onGameOver, stopRoundTimer, stopBotTimer, setMatchData, setRevealAnswers, triggerToast, isActive],
   );

   const acceptRematch = useCallback(
      async (onMatchFoundCallback: (newMatchId: string, role: "player1" | "player2") => void) => {
         const match = matchDataRef.current;
         if (!match) return;

         if (rematchTimerRef.current) clearInterval(rematchTimerRef.current);

         try {
            console.log("[WordUp Logs] Bot accepting rematch, generating new bot game...");
            const rawQuestions = generateWordUpQuestions(match.category);
            const secretKey = generateSecretKey();
            const encryptedStr = encryptQuestions(rawQuestions, secretKey);

            const newMatch = await wordupNetworkGate.enqueue(
               "post",
               "create rematch bot match row",
               async () => {
                  const { data, error } = await supabase
                     .from("wordup_matches")
                     .insert({
                        category: match.category,
                        player1_id: match.player1_id,
                        player2_id: "00000000-0000-0000-0000-000000000b0b",
                        is_bot_match: true,
                        game_type: "live-bot",
                        bot_profile: match.bot_profile || "average",
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
               true
            );

            if (!newMatch) throw new Error("Failed to create bot rematch");

            const myRole = "player1";
            onMatchFoundCallback(newMatch.id, myRole);
         } catch (e) {
            console.error("[WordUp Logs] Failed to accept bot rematch:", e);
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
         gameType: "live-bot"
      };
      safeLocalStorage.setItem("wordup_active_game", JSON.stringify(activeState));
   }, [isActive, matchId, role, questions, currentIdx, matchData, opponentStats, revealAnswers, selectedAnswer]);

   useEffect(() => {
      handleMatchUpdateRef.current = handleMatchUpdate;
   }, [handleMatchUpdate]);

   const loadAndSubscribeMatch = useCallback(
      async (mId: string, _activeRole: "player1" | "player2") => {
         let match;
         if (mId.startsWith("bot-match-")) {
            const category = useWordUpStore.getState().category || "mixed";
            const botProfile = matchDataRef.current?.bot_profile || "average";
            const rawQuestions = generateWordUpQuestions(category);
            
            let userId = "guest-player";
            try {
               const { data: { session } } = await supabase.auth.getSession();
               userId = session?.user?.id || localStorage.getItem('wordle_anon_id') || "guest-player";
            } catch (err) {
               console.warn("Failed to get session, fallback to guest:", err);
               userId = localStorage.getItem('wordle_anon_id') || "guest-player";
            }

            const secretKey = generateSecretKey();
            const encryptedStr = encryptQuestions(rawQuestions, secretKey);

            match = {
               id: mId,
               category,
               player1_id: userId,
               player2_id: "00000000-0000-0000-0000-000000000b0b",
               is_bot_match: true,
               game_type: "live-bot",
               bot_profile: botProfile,
               status: "countdown",
               current_question_index: 0,
               p1_answers: [],
               p2_answers: [],
               p1_score: 0,
               p2_score: 0,
               p1_answered: false,
               p2_answered: false,
               questions: encryptedStr,
               encryption_key: secretKey
            };

            setMatchData(match);
            setQuestions(rawQuestions);
         } else {
            try {
               match = await wordupNetworkGate.enqueue(
                  "get",
                  `load bot match details for ID ${mId}`,
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
               console.error("Error loading bot match:", error);
               return null;
            }

            setMatchData(match);

            if (match.questions && match.encryption_key) {
               try {
                  const dec = decryptQuestions(match.questions, match.encryption_key);
                  setQuestions(dec);
               } catch (e) {
                  console.error("Decrypt failed:", e);
               }
            }
         }

         setOpponentStats({
            rating: match.bot_profile === "impossible" ? 2200 : match.bot_profile === "master" ? 1800 : 1200,
            xp: 5000,
            games_played: 150,
            games_won: 95,
            games_lost: 50,
            games_tied: 5,
            rank_name: match.bot_profile === "impossible" ? "Diamond" : "Gold",
         } as any);

         return match;
      },
      [setMatchData, setQuestions, setOpponentStats],
   );

   const sendRematch = useCallback(() => {
      console.log("[WordUp Logs] Sending bot rematch request...");
      setRematchState("received");
      setRematchCountdown(20);
   }, []);

   const sendQuickChat = useCallback((text: string) => {
      window.dispatchEvent(new CustomEvent("wordup-quick-chat", {
         detail: { text, senderRole: roleRef.current }
      }));
   }, []);

   useEffect(() => {
      return () => {
         cleanUpIntervals();
         if (rematchTimerRef.current) clearInterval(rematchTimerRef.current);
      };
   }, [cleanUpIntervals]);

   return {
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
