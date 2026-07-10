// ── Simplified live game engine ────────────────────────────────────
// One useReducer, three useEffects, zero stale refs.
// Supports live-bot and live-PvP flows.

import { useReducer, useEffect, useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useLiveStore } from "../store/useLiveStore";
import { getQuestionDuration, calcPoints } from "./useGameEngine.core";
import {
   decryptMatchQuestions,
   generateWordUpQuestions,
   simulateBotResponse,
   getRandomBotProfile,
} from "../../../utils/wordupQuestionGenerator";
import { preloadMatchImages } from "../../../utils/wordupQuestionPostProcessor";
import { BOT_PROFILES } from "../../../utils/wordupQuestionGenerator";
import {
   gameReducer,
   initialGameState,
   type GameType,
} from "./useGameEngine.new.types";
import type { WordUpQuestion } from "../../../utils/wordupQuestionGenerator";

// ── Props ─────────────────────────────────────────────────────────

interface EngineProps {
   gameType: GameType;
   matchId: string | null;
   role: "player1" | "player2" | null;
   getSyncedNow: () => number;
   triggerToast: (msg: string, dur?: number) => void;
   onGameOver: (match: any) => void;
   onRematchAccepted: (newMatchId: string, role: "player1" | "player2") => void;
}

// ── Pick a wrong choice for bot incorrect answers ─────────────────

function pickBotChoice(q: WordUpQuestion, correct: boolean): string {
   if (correct) return q.answer;
   const wrong = q.choices.filter((c) => c !== q.answer);
   return wrong[Math.floor(Math.random() * wrong.length)] || "WRONG";
}

// ── Hook ──────────────────────────────────────────────────────────

export function useGameEngine(props: EngineProps) {
   const { gameType, matchId: _matchId, role: _role, getSyncedNow: _getSyncedNow, triggerToast, onGameOver } = props;
   const [state, dispatch] = useReducer(gameReducer, initialGameState);

   if (import.meta.env.DEV) {
      (window as any).__gameDispatch = dispatch;
   }

   // ── Zustand sync (one effect) ──────────────────────────────────
   useEffect(() => {
      const s = useLiveStore.getState();
      const status = state.status;
      if (status === "idle") return; // don't touch view until match starts

      if (status === "countdown") s.setView("countdown");
      else if (status === "playing" || status === "reveal") s.setView("battle");
      else if (status === "gameover") s.setView("gameover");

      s.setIsBattlePlaying(status === "playing" || status === "reveal");
      s.setSelectedAnswer(state.myChoice);
      s.setTimeLeft(state.timeRemaining);
      s.setMaxTime(state.maxTime);
      s.setCurrentIdx(state.currentRound);
      s.setRevealAnswers(state.status === "reveal");
      if (state.matchData) {
         const showRunning = status === "playing" || status === "reveal";
         const runningMy = state.myScore + (showRunning ? state.myCurrentPoints : 0);
         const runningOpp = state.opponentScore + (showRunning ? state.opponentCurrentPoints : 0);
         s.setMatchData({
            ...state.matchData,
            p1_score: state.role === "player1" ? runningMy : runningOpp,
            p2_score: state.role === "player1" ? runningOpp : runningMy,
         });
      }
      s.setQuestions(state.questions);
      s.setOpponentStats(state.opponentStats);
   }, [state]);

   // ── Countdown (3 → 2 → 1 → playing) ────────────────────────────
   useEffect(() => {
      if (state.status !== "countdown") return;
      let count = 3;
      dispatch({ type: "COUNTDOWN_TICK", text: "3" });

      const id = setInterval(() => {
         count--;
         if (count <= 0) {
            clearInterval(id);
            dispatch({ type: "COUNTDOWN_DONE" });
            dispatch({ type: "START_ROUND", round: 0, startedAt: Date.now() });
         } else {
            dispatch({ type: "COUNTDOWN_TICK", text: String(count) });
         }
      }, 1000);
      return () => clearInterval(id);
   }, [state.status]);

   // ── Timer tick (50ms) ──────────────────────────────────────────
   useEffect(() => {
      if (state.status !== "playing") return;
      const q = state.questions[state.currentRound];
      const duration = q ? getQuestionDuration(q.type) : 10;

      const id = setInterval(() => {
         const elapsed = (Date.now() - state.roundStartedAt) / 1000;
         const remaining = Math.max(0, duration - elapsed);
         dispatch({ type: "TICK", remaining });
         if (remaining <= 0) {
            clearInterval(id);
            dispatch({ type: "MY_ANSWER", choice: "", timeTaken: duration });
         }
      }, 50);
      return () => clearInterval(id);
   }, [state.status, state.currentRound, state.roundStartedAt, state.questions]);

   // ── Bot timeout ────────────────────────────────────────────────
   useEffect(() => {
      if (state.gameType !== "live-bot" || state.status !== "playing") return;
      if (state.opponentChoice !== null) return;

      const q = state.questions[state.currentRound];
      if (!q) return;
      const duration = getQuestionDuration(q.type);
      const br = simulateBotResponse(q, "average", duration);
      const delay = Math.max(500, br.time_taken * 1000);

      const id = setTimeout(() => {
         const choice = pickBotChoice(q, br.correct);
         const pts = calcPoints(br.correct, br.time_taken, duration, state.currentRound === 6);
         dispatch({ type: "OPPONENT_ANSWER", choice, timeTaken: br.time_taken, correct: br.correct, points: pts });
      }, delay);
      return () => clearTimeout(id);
   }, [state.status, state.currentRound, state.gameType, state.opponentChoice, state.questions]);

   // ── Reveal → Advance / GameOver ────────────────────────────────
   useEffect(() => {
      if (state.status !== "reveal") return;
      if (state.lastRoundPopup) return; // raw setTimeout below owns the advance

      const isLast = state.currentRound >= 6;
      const delay = isLast ? 3200 : 1800;

      const id = setTimeout(() => {
         if (isLast) {
            dispatch({ type: "GAMEOVER" });
            onGameOver(buildFinalMatch({
               matchData: state.matchData,
               role: state.role,
               myScore: state.myScore + state.myCurrentPoints,
               opponentScore: state.opponentScore + state.opponentCurrentPoints,
            }));
         } else if (state.currentRound === 5) {
            // Round 5 → 6: show overlay, delay advance with a raw setTimeout
            triggerToast("FINAL ROUND: DOUBLE POINTS!", 3000);
            dispatch({ type: "SET_LAST_ROUND_POPUP", show: true });
            setTimeout(() => dispatch({ type: "ADVANCE" }), 1500);
         } else {
            dispatch({ type: "ADVANCE" });
         }
      }, delay);
      return () => clearTimeout(id);
   }, [state.status, state.currentRound, state.lastRoundPopup, state.myScore, state.opponentScore, state.myCurrentPoints, state.opponentCurrentPoints, state.matchData, state.role, triggerToast, onGameOver]);

   // ── Handle my answer ───────────────────────────────────────────
   const handleAnswerSelect = useCallback((choice: string) => {
      if (state.myChoice !== null || state.status !== "playing") return;

      const elapsed = (Date.now() - state.roundStartedAt) / 1000;
      const timeTaken = parseFloat(elapsed.toFixed(2));
      dispatch({ type: "MY_ANSWER", choice, timeTaken });

      if (state.gameType === "live-bot") {
         const q = state.questions[state.currentRound];
         if (!q) return;
         const duration = getQuestionDuration(q.type);
         const br = simulateBotResponse(q, "average", duration);
         const botChoice = pickBotChoice(q, br.correct);
         const pts = calcPoints(br.correct, br.time_taken, duration, state.currentRound === 6);
         dispatch({ type: "OPPONENT_ANSWER", choice: botChoice, timeTaken: br.time_taken, correct: br.correct, points: pts });
      }
   }, [state.myChoice, state.status, state.gameType, state.currentRound, state.questions, state.roundStartedAt]);

   // ── Opponent answer (from broadcast for live PvP) ──────────────
   // Called by LiveView when broadcast `player_answered` arrives.
   const handleOpponentAnswer = useCallback((choice: string, timeTaken: number) => {
      const q = state.questions[state.currentRound];
      const correct = choice === q?.answer;
      const duration = q ? getQuestionDuration(q.type) : 10;
      const pts = calcPoints(correct, timeTaken, duration, state.currentRound === 6);
      dispatch({ type: "OPPONENT_ANSWER", choice, timeTaken, correct, points: pts });
   }, [state.currentRound, state.questions]);

   // ── Start match (loads data, dispatches SET_INITIAL) ──────────
   const startMatch = useCallback(async (mId: string, activeRole: "player1" | "player2") => {
      let questions: WordUpQuestion[] = [];
      let matchData: any = null;
      let oppStats: any = null;

      if (mId.startsWith("bot-match-")) {
         // Local bot match — generate questions on the fly
         matchData = {
            id: mId, category: "mixed", status: "active",
            is_bot_match: true, game_type: "live-bot", current_question_index: 0,
            p1_answers: [], p2_answers: [], p1_answered: false, p2_answered: false,
            p1_score: 0, p2_score: 0,
         };
         questions = await generateWordUpQuestions(matchData.category || "mixed");
         const bp = getRandomBotProfile();
         const prof = BOT_PROFILES[bp];
         oppStats = { username: prof?.name || "Bot", rating: 600, xp: 0, games_played: 0, games_won: 0, games_lost: 0, games_tied: 0, rank_name: "Bronze" };
      } else {
         // Live match — load from Supabase
         const { data: match } = await supabase.from("wordup_matches").select("*").eq("id", mId).single();
         if (!match) return;
         matchData = match;
         questions = await decryptMatchQuestions(match);
         await preloadMatchImages(questions);

         // Load opponent profile
         if (gameType === "live") {
            const oppId = activeRole === "player1" ? match.player2_id : match.player1_id;
            if (oppId) {
               const profileResult = await supabase.from("profiles").select("username, avatar_url").eq("id", oppId).single();
               const profile = profileResult.data;
               oppStats = profile ? { ...profile, rating: 600, xp: 0, games_played: 0, games_won: 0, games_lost: 0, games_tied: 0, rank_name: "Bronze" } : null;
            }
         }
      }

      dispatch({
         type: "SET_INITIAL",
         payload: { matchId: mId, gameType, role: activeRole, questions, matchData, opponentStats: oppStats },
      });
   }, [gameType]);

   // ── Stub functions (existing LiveView depends on these) ────────
   const sendRematch = useCallback(() => {}, []);
   const acceptRematch = useCallback((_cb: any) => {}, []);
   const sendQuickChat = useCallback(() => {}, []);
   const sendSignalUpdate = useCallback((_level?: number) => {}, []);
   const cleanup = useCallback(() => {}, []);
   const abortMatch = useCallback(async () => { dispatch({ type: "RESET" }); }, []);
   const purgeAndReset = useCallback(async () => { dispatch({ type: "RESET" }); }, []);

   return {
      state: {
         ...state,
         phase: state.status,
         selectedAnswer: state.myChoice,
         rematchState: "idle" as const,
         rematchCountdown: 0,
         showRematchButton: false,
         isConnected: true,
         opponentSignalLevel: 0,
         countdownText: state.countdownText,
          lastRoundPopup: state.lastRoundPopup,
      },
      isConnected: true,
      opponentSignalLevel: 0,
      startMatch,
      handleAnswerSelect,
      handleOpponentAnswer,
      sendRematch,
      acceptRematch,
      sendQuickChat,
      sendSignalUpdate,
      cleanup,
      abortMatch,
      purgeAndReset,
   };
}

// ── Helper: build final match data for onGameOver ──────────────────

function buildFinalMatch(state: { matchData: any; role: "player1" | "player2" | null; myScore: number; opponentScore: number }) {
   return {
      ...state.matchData,
      p1_score: state.role === "player1" ? state.myScore : state.opponentScore,
      p2_score: state.role === "player1" ? state.opponentScore : state.myScore,
      p1_answered: true,
      p2_answered: true,
      status: "completed",
      completed_at: new Date().toISOString(),
   };
}
