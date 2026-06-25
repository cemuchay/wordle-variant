import { type WordUpQuestion } from "../../../../utils/wordupQuestionGenerator";
import { type ProfileStats } from "../types";

export type GamePhase = "idle" | "loading" | "countdown" | "playing" | "reveal" | "gameover" | "turn_submitted";

export type GameType = "live" | "live-bot" | "async";

export type RematchState = "idle" | "sent" | "received" | "expired";

export interface EngineState {
  phase: GamePhase;
  currentRound: number;
  timeLeft: number;
  maxTime: number;
  selectedAnswer: string | null;
  revealAnswers: boolean;
  matchData: any;
  questions: WordUpQuestion[];
  opponentStats: ProfileStats | null;
  rematchState: RematchState;
  rematchCountdown: number;
  showRematchButton: boolean;
  countdownText: string;
  lastRoundPopup: boolean;
}

export type EngineAction =
  | { type: "SET_PHASE"; phase: GamePhase }
  | { type: "SET_ROUND"; round: number; timeLeft: number; maxTime: number }
  | { type: "ANSWER_SELECTED"; answer: string }
  | { type: "CLEAR_ANSWER" }
  | { type: "REVEAL" }
  | { type: "HIDE_REVEAL" }
  | { type: "SET_MATCH_DATA"; data: any }
  | { type: "SET_QUESTIONS"; questions: WordUpQuestion[] }
  | { type: "SET_OPPONENT_STATS"; stats: ProfileStats }
  | { type: "TICK"; timeLeft: number }
  | { type: "SET_REMATCH_STATE"; state: RematchState }
  | { type: "SET_REMATCH_COUNTDOWN"; count: number }
  | { type: "SHOW_REMATCH_BUTTON"; show: boolean }
  | { type: "SET_COUNTDOWN_TEXT"; text: string }
  | { type: "ADVANCE_ROUND"; round: number }
  | { type: "SET_LAST_ROUND_POPUP"; show: boolean }
  | { type: "RESET" };

export const initialState: EngineState = {
  phase: "idle",
  currentRound: 0,
  timeLeft: 10.0,
  maxTime: 10.0,
  selectedAnswer: null,
  revealAnswers: false,
  matchData: null,
  questions: [],
  opponentStats: null,
  rematchState: "idle",
  rematchCountdown: 10,
  showRematchButton: false,
  countdownText: "3",
  lastRoundPopup: false,
};

export function gameEngineReducer(state: EngineState, action: EngineAction): EngineState {
  switch (action.type) {
    case "SET_PHASE":
      return { ...state, phase: action.phase };
    case "SET_ROUND":
      return {
        ...state,
        currentRound: action.round,
        timeLeft: action.timeLeft,
        maxTime: action.maxTime,
      };
    case "ANSWER_SELECTED":
      return { ...state, selectedAnswer: action.answer };
    case "CLEAR_ANSWER":
      return { ...state, selectedAnswer: null };
    case "REVEAL":
      return { ...state, revealAnswers: true };
    case "HIDE_REVEAL":
      return { ...state, revealAnswers: false };
    case "SET_MATCH_DATA":
      return { ...state, matchData: action.data };
    case "SET_QUESTIONS":
      return { ...state, questions: action.questions };
    case "SET_OPPONENT_STATS":
      return { ...state, opponentStats: action.stats };
    case "TICK":
      return { ...state, timeLeft: action.timeLeft };
    case "SET_REMATCH_STATE":
      return { ...state, rematchState: action.state };
    case "SET_REMATCH_COUNTDOWN":
      return { ...state, rematchCountdown: action.count };
    case "SHOW_REMATCH_BUTTON":
      return { ...state, showRematchButton: action.show };
    case "SET_COUNTDOWN_TEXT":
      return { ...state, countdownText: action.text };
    case "ADVANCE_ROUND":
      return { ...state, currentRound: action.round, selectedAnswer: null, revealAnswers: false };
    case "SET_LAST_ROUND_POPUP":
      return { ...state, lastRoundPopup: action.show };
    case "RESET":
      return { ...initialState };
    default:
      return state;
  }
}
