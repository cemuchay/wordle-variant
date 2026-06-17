import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { fetchWithRetry } from "../../../../utils/fetchWithRetry";
import {
   decryptQuestions,
   simulateBotResponse,
   type WordUpQuestion
} from "../../../../utils/wordupQuestionGenerator";
import { type ProfileStats } from "../types";

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

      const elapsed = parseFloat((10.0 - timeLeft).toFixed(2));
      const q = questions[currentIdx];
      const correct = choice === q?.answer;

      let points = 0;
      if (correct) {
         const speedBonus = Math.max(0, Math.round((1.0 - elapsed / 10.0) * 50));
         points = 100 + speedBonus;
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
      setTimeLeft(10.0);
      isSubmittingAnswerRef.current = false;

      const startTime = match.question_started_at
         ? new Date(match.question_started_at).getTime()
         : getSyncedNow();

      timerRef.current = window.setInterval(() => {
         const now = getSyncedNow();
         const elapsed = (now - startTime) / 1000;
         const remaining = Math.max(0, 10.0 - elapsed);

         setTimeLeft(parseFloat(remaining.toFixed(2)));

         if (remaining <= 0) {
            if (timerRef.current) clearInterval(timerRef.current);
            handleAnswerSelect("");
         }
      }, 50);

      if (match.is_bot_match && role === "player1" && questions[index]) {
         const q = questions[index];
         const botProf = match.bot_profile || "average";
         const botAction = simulateBotResponse(q, botProf);

         botTimerRef.current = window.setTimeout(async () => {
            const botAnswers = [...(match.p2_answers || [])];
            botAnswers.push({
               question_idx: index,
               correct: botAction.correct,
               time_taken: botAction.time_taken,
               points: botAction.points
            });

            try {
               await fetchWithRetry(async () => {
                  const { error } = await supabase
                     .from("wordup_matches")
                     .update({
                        p2_answers: botAnswers,
                        p2_answered: true,
                        p2_score: (match.p2_score || 0) + botAction.points
                     })
                     .eq("id", match.id);
                  if (error) throw error;
               }, 3, 1000);
            } catch (e) {
               console.error("Bot round submission update failed:", e);
            }
         }, botAction.time_taken * 1000);
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
            } else if (role === "player2") {
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
