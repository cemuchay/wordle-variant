/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useCallback, useEffect } from "react";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "../../../hooks/useAuth";
import { useApp } from "../../../context/AppContext";
import { useServerTime } from "./hooks/useServerTime";
import { useWordUpProfile } from "./hooks/useWordUpProfile";
import { useWordUpMatchmaking } from "./hooks/useWordUpMatchmaking";
import { useWordUpGameLoop } from "./hooks/useWordUpGameLoop";
import { wordupAudio } from "../../../utils/wordupAudio";
import { supabase } from "../../../lib/supabaseClient";

import { LobbyView } from "./components/LobbyView";
import { MatchmakingView } from "./components/MatchmakingView";
import { CountdownView } from "./components/CountdownView";
import { BattleView } from "./components/BattleView";
import { GameOverView } from "./components/GameOverView";
import { ConnectionOverlay } from "./components/ConnectionOverlay";

import { useWordUpStore } from "../../../store/useWordUpStore";

export const WordUpView = () => {
   const { user } = useAuth();
   const { triggerToast, realtimeStatus } = useApp();

   const view = useWordUpStore((s) => s.view);
   const setView = useWordUpStore((s) => s.setView);
   const category = useWordUpStore((s) => s.category);
   const setCategory = useWordUpStore((s) => s.setCategory);
   const matchId = useWordUpStore((s) => s.matchId);
   const setMatchId = useWordUpStore((s) => s.setMatchId);
   const role = useWordUpStore((s) => s.role);
   const setRole = useWordUpStore((s) => s.setRole);
   const resetGame = useWordUpStore((s) => s.resetGame);

   const [countdownText, setCountdownText] = useState("3");

   const { getSyncedNow } = useServerTime();
   const { userStats, getRankColor, updateStats } = useWordUpProfile(user);

   const [soundEnabled, setSoundEnabled] = useState(wordupAudio.isEnabled());

   const handleToggleSound = useCallback(() => {
      const newVal = !soundEnabled;
      setSoundEnabled(newVal);
      wordupAudio.setEnabled(newVal);
   }, [soundEnabled]);

   useEffect(() => {
      if (view === "matchmaking" || view === "countdown" || view === "battle") {
         wordupAudio.startAmbient();
      } else {
         wordupAudio.stopAmbient();
      }
      return () => {
         wordupAudio.stopAmbient();
      };
   }, [view]);

   const onGameOver = useCallback(async (match: any) => {
      if (view === "gameover") return;
      setView("gameover");

      if (!user) return;
      const isP1 = role === "player1";
      const myScore = isP1 ? match.p1_score : match.p2_score;
      const oppScore = isP1 ? match.p2_score : match.p1_score;

      const won = myScore > oppScore;
      const tied = myScore === oppScore;

      const myAnswers = isP1 ? match.p1_answers : match.p2_answers;
      const correctCount = myAnswers?.filter((a: any) => a.correct).length || 0;

      const xpReward = 50 + (won ? 100 : 0) + (correctCount * 10);
      const eloGain = won ? 18 + Math.max(0, correctCount) : tied ? 2 : -12;

      try {
         await updateStats(eloGain, xpReward, won, tied);
      } catch (err) {
         triggerToast("Rating update delayed. Syncing in background...", 4000);
      }
   }, [user, view, updateStats, triggerToast, role]);

   const {
      questions,
      currentIdx,
      matchData,
      setMatchData,
      matchChannelRef,
      opponentStats,
      timeLeft,
      maxTime,
      selectedAnswer,
      revealAnswers,
      handleAnswerSelect,
      loadAndSubscribeMatch,
      startQuestionRound,
      cleanUpIntervals: cleanUpGameLoop
   } = useWordUpGameLoop(matchId, role, getSyncedNow, triggerToast, onGameOver);

   // Reactive sync: If matchData status changes to active externally, jump to battle
   useEffect(() => {
      if (matchData?.status === "active" && view === "countdown") {
         console.log("[WordUp Logs] Match status became ACTIVE. Transitioning to battle...");
         setView("battle");
         startQuestionRound(matchData, matchData.current_question_index || 0);
      }
   }, [matchData?.status, view, setView, startQuestionRound, matchData]);

   const startCountdown = useCallback((match: any) => {
      let count = 3;
      setCountdownText("3");
      const interval = setInterval(() => {
         count--;
         if (count === 0) {
            clearInterval(interval);
            setView("battle");

            // Broadcast game_active to opponent for zero-latency start
            matchChannelRef.current?.send({
               type: "broadcast",
               event: "game_active",
            });

            // Update local state immediately
            setMatchData({ ...match, status: "active" });

            // Set match status to active in database in background
            if (role === "player2" || match.is_bot_match) {
               fetchWithRetry(async () => {
                  const { error } = await supabase
                     .from("wordup_matches")
                     .update({ status: "active" })
                     .eq("id", match.id);
                  if (error) throw error;
               }, 3, 500).catch(err => console.error("Failed to sync active status to DB:", err));
            }

            startQuestionRound(match, 0);
         } else {
            setCountdownText(String(count));
         }
      }, 1000);
   }, [startQuestionRound, role, setView, setMatchData, matchChannelRef]);

   const onMatchFound = useCallback(async (mId: string, mRole: "player1" | "player2") => {
      setMatchId(mId);
      setRole(mRole);
      const match = await loadAndSubscribeMatch(mId, mRole);
      if (match) {
         wordupAudio.playMatchStart();
         setView("countdown");
         startCountdown(match);
      }
   }, [loadAndSubscribeMatch, startCountdown, setMatchId, setRole, setView]);

   const cleanUpAll = useCallback(() => {
      cleanUpGameLoop();
   }, [cleanUpGameLoop]);

   const {
      countdownSecs,
      startMatchmaking,
      cancelMatchmaking
   } = useWordUpMatchmaking(user, category, getSyncedNow, triggerToast, onMatchFound, cleanUpAll);

   const handleCancelMatchmaking = useCallback(async () => {
      await cancelMatchmaking();
      setView("menu");
   }, [cancelMatchmaking]);

   return (
      <div className="w-full max-w-lg mx-auto h-full flex flex-col bg-dark overflow-y-auto scrollbar-hide p-4 relative" style={{ minHeight: "100%" }}>
         <AnimatePresence mode="wait">
            {view === "menu" && (
               <LobbyView
                  userStats={userStats}
                  category={category}
                  setCategory={setCategory}
                  startMatchmaking={() => {
                     setView("matchmaking");
                     startMatchmaking();
                  }}
                  getRankColor={getRankColor}
                  soundEnabled={soundEnabled}
                  onToggleSound={handleToggleSound}
               />
            )}

            {view === "matchmaking" && (
               <MatchmakingView
                  category={category}
                  cancelMatchmaking={handleCancelMatchmaking}
                  countdownSecs={countdownSecs}
               />
            )}

            {view === "countdown" && (
               <CountdownView countdownText={countdownText} />
            )}

            {view === "battle" && (
               <BattleView
                  questions={questions}
                  currentIdx={currentIdx}
                  matchData={matchData}
                  opponentStats={opponentStats}
                  timeLeft={timeLeft}
                  maxTime={maxTime}
                  selectedAnswer={selectedAnswer}
                  revealAnswers={revealAnswers}
                  handleAnswerSelect={handleAnswerSelect}
                  role={role}
               />
            )}

            {view === "gameover" && (
               <GameOverView
                  matchData={matchData}
                  setView={(newView) => {
                     if (newView === "menu") {
                        resetGame();
                     } else {
                        setView(newView);
                     }
                  }}
               />
            )}
         </AnimatePresence>

         <ConnectionOverlay realtimeStatus={realtimeStatus} view={view} />
      </div>
   );
};

export default WordUpView;
