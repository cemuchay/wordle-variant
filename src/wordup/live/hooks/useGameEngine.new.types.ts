// ── Simplified live game engine — types ───────────────────────────
// One reducer, three effects, zero stale refs.

import type { WordUpQuestion } from "../../../utils/wordupQuestionGenerator";

export type GameType = "live" | "live-bot";

export interface RoundRecord {
   questionIdx: number;
   prompt: string;
   choices: string[];
   correctAnswer: string;
   myAnswer: string;
   myCorrect: boolean;
   myPoints: number;
   myTimeTaken: number;
   opponentAnswer: string;
   opponentCorrect: boolean;
   opponentPoints: number;
   opponentTimeTaken: number;
}

export interface GameState {
   gameType: GameType;
   matchId: string;
   role: "player1" | "player2" | null;
   status: "idle" | "countdown" | "playing" | "reveal" | "gameover";
   questions: WordUpQuestion[];
   matchData: any;
   opponentStats: any;

   currentRound: number;
   roundStartedAt: number;
   myChoice: string | null;
   opponentChoice: string | null;
   timeRemaining: number;
   maxTime: number;
   revealAnswers: boolean;

   myScore: number;
   opponentScore: number;
   myCurrentPoints: number;   // points earned in the current round (set by MY_ANSWER)
   opponentCurrentPoints: number;
   rounds: RoundRecord[];

   countdownText: string;
   lastRoundPopup: boolean;
   isConnected: boolean;
}

export type Action =
   | { type: "SET_INITIAL"; payload: {
        matchId: string; gameType: GameType; role: "player1" | "player2";
        questions: WordUpQuestion[]; matchData: any; opponentStats: any;
     }}
   | { type: "COUNTDOWN_TICK"; text: string }
   | { type: "COUNTDOWN_DONE" }
   | { type: "START_ROUND"; round: number; startedAt: number }
   | { type: "TICK"; remaining: number }
   | { type: "MY_ANSWER"; choice: string; timeTaken: number }
   | { type: "OPPONENT_ANSWER"; choice: string; timeTaken: number; correct: boolean; points: number }
   | { type: "START_REVEAL" }
   | { type: "ADVANCE" }
   | { type: "GAMEOVER" }
   | { type: "SET_LAST_ROUND_POPUP"; show: boolean }
   | { type: "RESET" };

export const initialGameState: GameState = {
   gameType: "live-bot",
   matchId: "",
   role: null,
   status: "idle",
   questions: [],
   matchData: null,
   opponentStats: null,
   currentRound: 0,
   roundStartedAt: 0,
   myChoice: null,
   opponentChoice: null,
   timeRemaining: 10,
   maxTime: 10,
   revealAnswers: false,
   myScore: 0,
   opponentScore: 0,
   myCurrentPoints: 0,
   opponentCurrentPoints: 0,
   rounds: [],
   countdownText: "3",
   lastRoundPopup: false,
   isConnected: true,
};

export function gameReducer(state: GameState, action: Action): GameState {
   switch (action.type) {
      case "SET_INITIAL":
         return { ...initialGameState, ...action.payload, status: "countdown" };

      case "COUNTDOWN_TICK":
         return { ...state, countdownText: action.text };

      case "COUNTDOWN_DONE":
         return { ...state, status: "playing" };

      case "START_ROUND":
         return { ...state, currentRound: action.round, roundStartedAt: action.startedAt };

      case "TICK":
         return { ...state, timeRemaining: action.remaining };

      case "MY_ANSWER": {
         if (state.myChoice !== null) return state;
         const q = state.questions[state.currentRound];
         const dur = q ? 10 : 10;
         const correct = action.choice === q?.answer;
         const pts = correct ? Math.max(11, Math.round(20 * (1 - Math.max(0, action.timeTaken - 1.5) / (dur - 1.5 > 0 ? dur - 1.5 : dur)))) : 0;
         const finalPts = state.currentRound === 6 ? pts * 2 : pts;
         const newState = { ...state, myChoice: action.choice, myCurrentPoints: finalPts };
         if (state.opponentChoice !== null) {
            newState.status = "reveal";
            newState.revealAnswers = true;
         }
         return newState;
      }

      case "OPPONENT_ANSWER": {
         if (state.opponentChoice !== null) return state;
         const newState = {
            ...state,
            opponentChoice: action.choice,
            opponentCurrentPoints: action.points,
         };
         if (state.myChoice !== null) {
            newState.status = "reveal";
            newState.revealAnswers = true;
         }
         return newState;
      }

      case "ADVANCE": {
         const nextRound = state.currentRound + 1;
         if (nextRound > 6) return state;
         return {
            ...state,
            myScore: state.myScore + state.myCurrentPoints,
            opponentScore: state.opponentScore + state.opponentCurrentPoints,
            currentRound: nextRound,
            status: "playing",
            roundStartedAt: Date.now(),
            myChoice: null,
            opponentChoice: null,
            myCurrentPoints: 0,
            opponentCurrentPoints: 0,
            timeRemaining: state.maxTime,
            revealAnswers: false,
            lastRoundPopup: false,
         };
      }

      case "GAMEOVER": {
         const totalMy = state.myScore + state.myCurrentPoints;
         const totalOpp = state.opponentScore + state.opponentCurrentPoints;
         return { ...state, status: "gameover", revealAnswers: false, myScore: totalMy, opponentScore: totalOpp };
      }

      case "SET_LAST_ROUND_POPUP":
         return { ...state, lastRoundPopup: action.show };

      case "RESET":
         return { ...initialGameState };

      default:
         return state;
   }
}
