/* eslint-disable @typescript-eslint/no-explicit-any */
import { useRef, useCallback, useEffect } from "react";
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

   const timerRef = useRef<number | null>(null);
   const botTimerRef = useRef<number | null>(null);
   const isSubmittingAnswerRef = useRef(false);
   const matchChannelRef = useRef<any>(null);

   const currentIdxRef = useRef(currentIdx);
   const matchDataRef = useRef(matchData);
   const questionsRef = useRef(questions);
   const revealAnswersRef = useRef(revealAnswers);
   const timeLeftRef = useRef(timeLeft);

   useEffect(() => { currentIdxRef.current = currentIdx; }, [currentIdx]);
   useEffect(() => { matchDataRef.current = matchData; }, [matchData]);
   useEffect(() => { questionsRef.current = questions; }, [questions]);
   useEffect(() => { revealAnswersRef.current = revealAnswers; }, [revealAnswers]);
   useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);

   const cleanUpIntervals = useCallback(() => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
   }, []);

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
         try {
            console.log(`[WordUp Logs] advanceRound: Advancing to index ${nextIdx}`);
            await fetchWithRetry(
               async () => {
                  const { error } = await supabase
                     .from("wordup_matches")
                     .update({
                        current_question_index: nextIdx,
                        p1_answered: false,
                        p2_answered: false,
                        question_started_at: new Date(
                           getSyncedNow(),
                        ).toISOString(),
                     })
                     .eq("id", mId);
                  if (error) throw error;
               },
               3,
               1000,
            );
         } catch (e) {
            console.error("[WordUp Logs] Failed to advance round:", e);
         }
      },
      [getSyncedNow],
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
         cleanUpIntervals();

         const q = questionsRef.current[currentIdxRef.current];
         const duration = q ? getQuestionDuration(q.type) : 10.0;
         const elapsed = parseFloat((duration - timeLeftRef.current).toFixed(2));
         const correct = choice === q?.answer;

         console.log(`[WordUp Logs] handleAnswerSelect: Choice: "${choice}", Correct: ${correct}, Elapsed: ${elapsed}s, round index: ${currentIdxRef.current}`);

         let points = 0;
         if (correct) {
            const speedBonus = Math.max(
               0,
               Math.round((1.0 - elapsed / duration) * 50),
            );
            points = 100 + speedBonus;
         }

         if (choice !== "") {
            if (correct) {
               wordupAudio.playCorrect();
            } else {
               wordupAudio.playIncorrect();
            }
         }

         const submission = {
            question_idx: currentIdxRef.current,
            correct,
            time_taken: elapsed,
            points,
         };

         console.log("[WordUp Logs] Syncing answer to database...", submission);

         try {
            const { data: latestMatch, error: fetchErr } = await supabase
               .from("wordup_matches")
               .select("*")
               .eq("id", matchId)
               .single();

            if (fetchErr || !latestMatch) {
               throw (
                  fetchErr || new Error("Failed to fetch latest match state")
               );
            }

            if (role === "player1") {
               const answers = [...(latestMatch.p1_answers || [])];
               if (answers.some((a: any) => a.question_idx === currentIdxRef.current)) {
                  console.warn("[WordUp Logs] Answer for this round already submitted in database.");
                  isSubmittingAnswerRef.current = false;
                  return;
               }
               answers.push(submission);

               await fetchWithRetry(
                  async () => {
                     const { error } = await supabase
                        .from("wordup_matches")
                        .update({
                           p1_answers: answers,
                           p1_answered: true,
                           p1_score: (latestMatch.p1_score || 0) + points,
                        })
                        .eq("id", matchId);
                     if (error) throw error;
                  },
                  3,
                  1000,
               );
               console.log("[WordUp Logs] Player 1 answer synced successfully.");
            } else {
               const answers = [...(latestMatch.p2_answers || [])];
               if (answers.some((a: any) => a.question_idx === currentIdxRef.current)) {
                  console.warn("[WordUp Logs] Answer for this round already submitted in database.");
                  isSubmittingAnswerRef.current = false;
                  return;
               }
               answers.push(submission);

               await fetchWithRetry(
                  async () => {
                     const { error } = await supabase
                        .from("wordup_matches")
                        .update({
                           p2_answers: answers,
                           p2_answered: true,
                           p2_score: (latestMatch.p2_score || 0) + points,
                        })
                        .eq("id", matchId);
                     if (error) throw error;
                  },
                  3,
                  1000,
               );
               console.log("[WordUp Logs] Player 2 answer synced successfully.");
            }
         } catch (err) {
            console.error("[WordUp Logs] Score submission update failed:", err);
            triggerToast("Sync error. Recovering score...", 3000);
            isSubmittingAnswerRef.current = false;
         }
      },
      [
         selectedAnswer,
         matchId,
         role,
         cleanUpIntervals,
         triggerToast,
      ],
   );

   const startQuestionRound = useCallback(
      (match: any, index: number) => {
         console.log(`[WordUp Logs] startQuestionRound: Initiating round ${index + 1} (idx: ${index})`);
         cleanUpIntervals();
         setCurrentIdx(index);
         setSelectedAnswer(null);
         setRevealAnswers(false);

         const q = questionsRef.current[index];
         const duration = q ? getQuestionDuration(q.type) : 10.0;
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
               console.log(`[WordUp Logs] Timer expired for round ${index + 1}`);
               if (timerRef.current) clearInterval(timerRef.current);
               handleAnswerSelect("");
            }
         }, 50);

         if (match.is_bot_match && role === "player1" && questionsRef.current[index]) {
            const q = questionsRef.current[index];
            const botProf = match.bot_profile || "average";
            const botAction = simulateBotResponse(q, botProf);

            // Scale bot action time to fit within the adaptive duration
            const botTime = Math.min(botAction.time_taken, duration - 0.5);
            console.log(`[WordUp Logs] Bot response scheduled to submit in ${botTime}s (Profile: ${botProf})`);

            botTimerRef.current = window.setTimeout(async () => {
               console.log(`[WordUp Logs] Bot submitting answer for round ${index + 1}...`);
               const botAnswers = [...(match.p2_answers || [])];

               let botPoints = 0;
               if (botAction.correct) {
                  const speedBonus = Math.max(
                     0,
                     Math.round((1.0 - botTime / duration) * 50),
                  );
                  botPoints = 100 + speedBonus;
               }

               botAnswers.push({
                  question_idx: index,
                  correct: botAction.correct,
                  time_taken: parseFloat(botTime.toFixed(2)),
                  points: botPoints,
               });

               try {
                  await fetchWithRetry(
                     async () => {
                        const { error } = await supabase
                           .from("wordup_matches")
                           .update({
                              p2_answers: botAnswers,
                              p2_answered: true,
                              p2_score: (match.p2_score || 0) + botPoints,
                           })
                           .eq("id", match.id);
                        if (error) throw error;
                     },
                     3,
                     1000,
                  );
                  console.log(`[WordUp Logs] Bot answer synced successfully.`);
               } catch (e) {
                  console.error("[WordUp Logs] Bot round submission update failed:", e);
               }
            }, botTime * 1000);
         }
      },
      [cleanUpIntervals, getSyncedNow, handleAnswerSelect, role],
   );

   const handleMatchUpdate = useCallback(
      (newMatch: any) => {
         console.log(`[WordUp Logs] handleMatchUpdate: Received UPDATE. Match index: ${newMatch.current_question_index}, local index: ${currentIdxRef.current}, p1_answered: ${newMatch.p1_answered}, p2_answered: ${newMatch.p2_answered}, status: ${newMatch.status}`);
         setMatchData(newMatch);

         if (newMatch.p1_answered && newMatch.p2_answered && !revealAnswersRef.current) {
            console.log("[WordUp Logs] Both players answered. Revealing answers...");
            cleanUpIntervals();
            setRevealAnswers(true);

            setTimeout(() => {
               const nextIdx = newMatch.current_question_index + 1;
               if (nextIdx >= 7) {
                  console.log("[WordUp Logs] Reached end of 7 rounds. Ending match...");
                  endGame(newMatch);
               } else if (role === "player2" || newMatch.is_bot_match) {
                  console.log(`[WordUp Logs] Triggering advance to index ${nextIdx}...`);
                  advanceRound(newMatch.id, nextIdx);
               }
            }, 1800);
         }

         if (
            newMatch.current_question_index !== currentIdxRef.current &&
            (newMatch.status === "active" || newMatch.status === "countdown")
         ) {
            console.log(`[WordUp Logs] Transitioning round: ${currentIdxRef.current} -> ${newMatch.current_question_index}`);
            startQuestionRound(newMatch, newMatch.current_question_index);
         }

         if (newMatch.status === "completed") {
            console.log("[WordUp Logs] Match marked as completed.");
            onGameOver(newMatch);
         }
      },
      [
         role,
         endGame,
         advanceRound,
         startQuestionRound,
         onGameOver,
         cleanUpIntervals,
      ],
   );

   const handleMatchUpdateRef = useRef(handleMatchUpdate);
   useEffect(() => {
      handleMatchUpdateRef.current = handleMatchUpdate;
   }, [handleMatchUpdate]);

   const loadAndSubscribeMatch = useCallback(
      async (mId: string) => {
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

         const oppId = role === "player1" ? match.player2_id : match.player1_id;
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
            .channel(`wordup_match_${mId}`)
            .on(
               "postgres_changes",
               {
                  event: "UPDATE",
                  schema: "public",
                  table: "wordup_matches",
                  filter: `id=eq.${mId}`,
               },
               (payload) => {
                  handleMatchUpdateRef.current(payload.new);
               },
            )
            .subscribe();

         matchChannelRef.current = chan;
         return match;
      },
      [role],
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
      selectedAnswer,
      revealAnswers,
      opponentStats,
      handleAnswerSelect,
      loadAndSubscribeMatch,
      startQuestionRound,
      cleanUpIntervals,
   };
};
