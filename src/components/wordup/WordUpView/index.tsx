import { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { useAuth } from "../../../hooks/useAuth";
import { useApp } from "../../../context/AppContext";
import { type WordUpGameState } from "./types";
import { useServerTime } from "./hooks/useServerTime";
import { useWordUpProfile } from "./hooks/useWordUpProfile";
import { useWordUpMatchmaking } from "./hooks/useWordUpMatchmaking";
import { useWordUpGameLoop } from "./hooks/useWordUpGameLoop";

import { LobbyView } from "./components/LobbyView";
import { MatchmakingView } from "./components/MatchmakingView";
import { CountdownView } from "./components/CountdownView";
import { BattleView } from "./components/BattleView";
import { GameOverView } from "./components/GameOverView";
import { ConnectionOverlay } from "./components/ConnectionOverlay";

export const WordUpView = () => {
   const { user } = useAuth();
   const { triggerToast, realtimeStatus } = useApp();

   const [view, setView] = useState<WordUpGameState>("menu");
   const [category, setCategory] = useState("mixed");
   const [countdownText, setCountdownText] = useState("3");
   const [matchId, setLocalMatchId] = useState<string | null>(null);
   const [role, setLocalRole] = useState<"player1" | "player2" | null>(null);

   const { getSyncedNow } = useServerTime();
   const { userStats, getRankColor, updateStats } = useWordUpProfile(user);

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
      opponentStats,
      timeLeft,
      selectedAnswer,
      revealAnswers,
      handleAnswerSelect,
      loadAndSubscribeMatch,
      startQuestionRound,
      cleanUpIntervals: cleanUpGameLoop
   } = useWordUpGameLoop(matchId, role, getSyncedNow, triggerToast, onGameOver);

   const startCountdown = useCallback((match: any) => {
      let count = 3;
      setCountdownText("3");
      const interval = setInterval(() => {
         count--;
         if (count === 0) {
            clearInterval(interval);
            setView("battle");
            startQuestionRound(match, 0);
         } else {
            setCountdownText(String(count));
         }
      }, 1000);
   }, [startQuestionRound]);

   const onMatchFound = useCallback(async (mId: string, mRole: "player1" | "player2") => {
      setLocalMatchId(mId);
      setLocalRole(mRole);
      const match = await loadAndSubscribeMatch(mId);
      if (match) {
         setView("countdown");
         startCountdown(match);
      }
   }, [loadAndSubscribeMatch, startCountdown]);

   const cleanUpAll = useCallback(() => {
      cleanUpGameLoop();
   }, [cleanUpGameLoop]);

   const {
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
               />
            )}

            {view === "matchmaking" && (
               <MatchmakingView
                  category={category}
                  cancelMatchmaking={handleCancelMatchmaking}
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
                  selectedAnswer={selectedAnswer}
                  revealAnswers={revealAnswers}
                  handleAnswerSelect={handleAnswerSelect}
               />
            )}

            {view === "gameover" && (
               <GameOverView
                  matchData={matchData}
                  setView={setView}
               />
            )}
         </AnimatePresence>

         <ConnectionOverlay realtimeStatus={realtimeStatus} view={view} />
      </div>
   );
};

export default WordUpView;
