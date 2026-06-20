/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { useWordUpStore } from "../../../../store/useWordUpStore";
import { useWordUpLiveGame } from "./useWordUpLiveGame";
import { useWordUpBotGame } from "./useWordUpBotGame";
import { useWordUpAsyncGame } from "./useWordUpAsyncGame";

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
       case "synonym_match":
       case "word_chain":
       case "letter_shift":
       case "compound_break":
       case "cryptogram":
       case "category_sort":
       case "letter_add_remove":
          return 12;
       case "reverse_wordle":
          return 15;
       case "word_within":
          return 20;
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
   const currentIdx = useWordUpStore((s) => s.currentIdx);
   const timeLeft = useWordUpStore((s) => s.timeLeft);
   const selectedAnswer = useWordUpStore((s) => s.selectedAnswer);
   const revealAnswers = useWordUpStore((s) => s.revealAnswers);
   const opponentStats = useWordUpStore((s) => s.opponentStats);
   const maxTime = useWordUpStore((s) => s.maxTime);

   // Determine the game type safely
   const gameType = matchData?.game_type
      ? matchData.game_type
      : matchData?.is_bot_match
        ? "live-bot"
        : matchData?.status === "waiting"
          ? "async"
          : "live";

   // Call all three hooks unconditionally (hook rules)
   const liveGame = useWordUpLiveGame({
      isActive: gameType === "live",
      matchId,
      role,
      getSyncedNow,
      triggerToast,
      onGameOver,
      onRematchAccepted,
   });

   const botGame = useWordUpBotGame({
      isActive: gameType === "live-bot",
      matchId,
      role,
      getSyncedNow,
      triggerToast,
      onGameOver,
      onRematchAccepted,
   });

   const asyncGame = useWordUpAsyncGame({
      isActive: gameType === "async",
      matchId,
      role,
      getSyncedNow,
      triggerToast,
      onGameOver,
   });

   // Coordinator delegation logic
   const handleAnswerSelect = useCallback(
      (choice: string) => {
         if (gameType === "live-bot") return botGame.handleAnswerSelect(choice);
         if (gameType === "async") return asyncGame.handleAnswerSelect(choice);
         return liveGame.handleAnswerSelect(choice);
      },
      [gameType, botGame, asyncGame, liveGame]
   );

   const startQuestionRound = useCallback(
      (match: any, index: number) => {
         if (gameType === "live-bot") return botGame.startQuestionRound(match, index);
         if (gameType === "async") return asyncGame.startQuestionRound(match, index);
         return liveGame.startQuestionRound(match, index);
      },
      [gameType, botGame, asyncGame, liveGame]
   );

   const cleanUpIntervals = useCallback(() => {
      liveGame.cleanUpIntervals();
      botGame.cleanUpIntervals();
      asyncGame.cleanUpIntervals();
   }, [liveGame, botGame, asyncGame]);

   const loadAndSubscribeMatch = useCallback(
      async (mId: string, activeRole: "player1" | "player2") => {
         if (mId.startsWith("bot-match-")) {
            return botGame.loadAndSubscribeMatch(mId, activeRole);
         }

         // Quick fetch to determine match details & game type
         let match;
         try {
            const { data, error } = await supabase
               .from("wordup_matches")
               .select("game_type, is_bot_match, status")
               .eq("id", mId)
               .single();
            if (error) throw error;
            match = data;
         } catch (err) {
            console.error("Failed to load match meta type:", err);
            return null;
         }

         const resolvedGameType = match.game_type
            ? match.game_type
            : match.is_bot_match
              ? "live-bot"
              : match.status === "waiting"
                ? "async"
                : "live";

         if (resolvedGameType === "live-bot") {
            return botGame.loadAndSubscribeMatch(mId, activeRole);
         } else if (resolvedGameType === "async") {
            return asyncGame.loadAndSubscribeMatch(mId, activeRole);
         } else {
            return liveGame.loadAndSubscribeMatch(mId, activeRole);
         }
      },
      [botGame, asyncGame, liveGame]
   );

   const rematchState = gameType === "live-bot" ? botGame.rematchState : liveGame.rematchState;
   const rematchCountdown = gameType === "live-bot" ? botGame.rematchCountdown : liveGame.rematchCountdown;
   const showRematchButton = gameType === "live-bot" ? botGame.showRematchButton : liveGame.showRematchButton;

   const sendRematch = useCallback(() => {
      if (gameType === "live-bot") return botGame.sendRematch();
      if (gameType === "live") return liveGame.sendRematch();
   }, [gameType, botGame, liveGame]);

   const acceptRematch = useCallback(
      (onMatchFoundCallback: (newMatchId: string, role: "player1" | "player2") => void) => {
         if (gameType === "live-bot") return botGame.acceptRematch(onMatchFoundCallback);
         if (gameType === "live") return liveGame.acceptRematch(onMatchFoundCallback);
      },
      [gameType, botGame, liveGame]
   );

   const sendQuickChat = useCallback(
      (text: string) => {
         if (gameType === "live-bot") return botGame.sendQuickChat(text);
         if (gameType === "live") return liveGame.sendQuickChat(text);
      },
      [gameType, botGame, liveGame]
   );

   return {
      matchData,
      setMatchData,
      matchChannelRef: liveGame.matchChannelRef,
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
