import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { fetchWithRetry } from "../../../../utils/fetchWithRetry";
import { wordupAudio } from "../../../../utils/wordupAudio";
import {
   decryptQuestions,
   simulateBotResponse,
   type WordUpQuestion
} from "../../../../utils/wordupQuestionGenerator";
import { type ProfileStats } from "../types";

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
   onGameOver: (match: any) => void
) => {
   const [matchData, setMatchData] = useState<any>(null);
   const [questions, setQuestions] = useState<WordUpQuestion[]>([]);
   const [currentIdx, setCurrentIdx] = useState(0);
   const [timeLeft, setTimeLeft] = useState(10.0);
   const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
   const [revealAnswers, setRevealAnswers] = useState(false);
   const [opponentStats, setOpponentStats] = useState<ProfileStats | null>(null);

   const timerRef = useRef<number | null>(null);
   const botTimerRef = useRef<number | null>(null);
   const isSubmittingAnswerRef = useRef(false);
   const matchChannelRef = useRef<any>(null);

   const cleanUpIntervals = useCallback(() => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (botTimerRef.current) clearTimeout(botTimerRef.current);
   }, []);

   const endGame = useCallback(async (match: any) => {
      try {
         await fetchWithRetry(async () => {
            const { error } = await supabase
               .from("wordup_matches")
               .update({
                  status: "completed",
                  completed_at: new Date().toISOString()
               })
               .eq("id", match.id);
            if (error) throw error;
         }, 3, 1000);
      } catch (e) {
         console.error("Failed to complete match status:", e);
      }
   }, []);

   const advanceRound = useCallback(async (mId: string, nextIdx: number) => {
      try {
         await fetchWithRetry(async () => {
            const { error } = await supabase
               .from("wordup_matches")
               .update({
                  current_question_index: nextIdx,
                  p1_answered: false,
                  p2_answered: false,
                  question_started_at: new Date(getSyncedNow()).toISOString()
               })
               .eq("id", mId);
            if (error) throw error;
         }, 3, 1000);
      } catch (e) {
         console.error("Failed to advance round:", e);
      }
   }, [getSyncedNow]);

   const handleAnswerSelect = useCallback(async (choice: string) => {
      if (isSubmittingAnswerRef.current || selectedAnswer !== null || revealAnswers || !matchId) return;

      isSubmittingAnswerRef.current = true;
      setSelectedAnswer(choice);
      cleanUpIntervals();

      const q = questions[currentIdx];
      const duration = q ? getQuestionDuration(q.type) : 10.0;
      const elapsed = parseFloat((duration - timeLeft).toFixed(2));
      const correct = choice === q?.answer;

      let points = 0;
      if (correct) {
         const speedBonus = Math.max(0, Math.round((1.0 - elapsed / duration) * 50));
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
         question_idx: currentIdx,
         correct,
         time_taken: elapsed,
         points
      };

      try {
         if (role === "player1") {
            const answers = [...(matchData.p1_answers || [])];
            answers.push(submission);

            await fetchWithRetry(async () => {
               const { error } = await supabase
                  .from("wordup_matches")
                  .update({
                     p1_answers: answers,
                     p1_answered: true,
                     p1_score: (matchData.p1_score || 0) + points
                  })
                  .eq("id", matchId);
               if (error) throw error;
            }, 3, 1000);
         } else {
            const answers = [...(matchData.p2_answers || [])];
            answers.push(submission);

            await fetchWithRetry(async () => {
               const { error } = await supabase
                  .from("wordup_matches")
                  .update({
                     p2_answers: answers,
                     p2_answered: true,
                     p2_score: (matchData.p2_score || 0) + points
                  })
                  .eq("id", matchId);
               if (error) throw error;
            }, 3, 1000);
         }
      } catch (err) {
         console.error("Score submission update failed:", err);
         triggerToast("Sync error. Recovering score...", 3000);
         isSubmittingAnswerRef.current = false;
      }
   }, [selectedAnswer, revealAnswers, matchId, timeLeft, questions, currentIdx, role, matchData, cleanUpIntervals, triggerToast]);

   const startQuestionRound = useCallback((match: any, index: number) => {
      cleanUpIntervals();
      setCurrentIdx(index);
      setSelectedAnswer(null);
      setRevealAnswers(false);
      
      const q = questions[index];
      const duration = q ? getQuestionDuration(q.type) : 10.0;
      setTimeLeft(duration);
      isSubmittingAnswerRef.current = false;

      const startTime = match.question_started_at
         ? new Date(match.question_started_at).getTime()
         : getSyncedNow();

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
            if (timerRef.current) clearInterval(timerRef.current);
            handleAnswerSelect("");
         }
      }, 50);

      if (match.is_bot_match && role === "player1" && questions[index]) {
         const q = questions[index];
         const botProf = match.bot_profile || "average";
         const botAction = simulateBotResponse(q, botProf);

         // Scale bot action time to fit within the adaptive duration
         const botTime = Math.min(botAction.time_taken, duration - 0.5);

         botTimerRef.current = window.setTimeout(async () => {
            const botAnswers = [...(match.p2_answers || [])];
            
            let botPoints = 0;
            if (botAction.correct) {
               const speedBonus = Math.max(0, Math.round((1.0 - botTime / duration) * 50));
               botPoints = 100 + speedBonus;
            }

            botAnswers.push({
               question_idx: index,
               correct: botAction.correct,
               time_taken: parseFloat(botTime.toFixed(2)),
               points: botPoints
            });

            try {
               await fetchWithRetry(async () => {
                  const { error } = await supabase
                      .from("wordup_matches")
                      .update({
                         p2_answers: botAnswers,
                         p2_answered: true,
                         p2_score: (match.p2_score || 0) + botPoints
                      })
                      .eq("id", match.id);
                  if (error) throw error;
               }, 3, 1000);
            } catch (e) {
               console.error("Bot round submission update failed:", e);
            }
         }, botTime * 1000);
      }
   }, [cleanUpIntervals, getSyncedNow, handleAnswerSelect, role, questions]);

   const handleMatchUpdate = useCallback((newMatch: any) => {
      setMatchData(newMatch);

      if (newMatch.p1_answered && newMatch.p2_answered && !revealAnswers) {
         cleanUpIntervals();
         setRevealAnswers(true);

         setTimeout(() => {
            const nextIdx = newMatch.current_question_index + 1;
            if (nextIdx >= 7) {
               endGame(newMatch);
            } else if (role === "player2" || newMatch.is_bot_match) {
               advanceRound(newMatch.id, nextIdx);
            }
         }, 1800);
      }

      if (newMatch.current_question_index !== currentIdx && newMatch.status === "active") {
         startQuestionRound(newMatch, newMatch.current_question_index);
      }

      if (newMatch.status === "completed") {
         onGameOver(newMatch);
      }
   }, [revealAnswers, role, endGame, advanceRound, currentIdx, startQuestionRound, onGameOver, cleanUpIntervals]);

   const loadAndSubscribeMatch = useCallback(async (mId: string) => {
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
            const dec = decryptQuestions(match.questions, match.encryption_key);
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
            rating: match.bot_profile === "impossible" ? 2200 : match.bot_profile === "master" ? 1800 : 1200,
            xp: 5000,
            games_played: 150,
            games_won: 95,
            games_lost: 50,
            games_tied: 5,
            rank_name: match.bot_profile === "impossible" ? "Diamond" : "Gold"
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
               filter: `id=eq.${mId}`
            },
            (payload) => {
               handleMatchUpdate(payload.new);
            }
         )
         .subscribe();

      matchChannelRef.current = chan;
      return match;
   }, [role, handleMatchUpdate]);

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
      cleanUpIntervals
   };
};
