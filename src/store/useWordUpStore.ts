// src/store/useWordUpStore.ts
import { create } from "zustand";
import { type WordUpQuestion } from "../utils/wordupQuestionGenerator";
import { type ProfileStats } from "../components/wordup/WordUpView/types";
import { safeLocalStorage } from "../utils/storage";

interface WordUpState {
   view:
      | "menu"
      | "connecting"
      | "matchmaking"
      | "countdown"
      | "battle"
      | "gameover"
      | "loading";
   category: string;
   matchId: string | null;
   role: "player1" | "player2" | null;
   questions: WordUpQuestion[];
   currentIdx: number;
   matchData: any;
   opponentStats: ProfileStats | null;
   countdownSecs: number;
   timeLeft: number;
   maxTime: number;
   selectedAnswer: string | null;
   revealAnswers: boolean;

   // Actions
   setView: (
      view:
         | "menu"
         | "connecting"
         | "matchmaking"
         | "countdown"
         | "battle"
         | "gameover"
         | "loading",
   ) => void;
   setCategory: (category: string) => void;
   setMatchId: (matchId: string | null) => void;
   setRole: (role: "player1" | "player2" | null) => void;
   setQuestions: (questions: WordUpQuestion[]) => void;
   setCurrentIdx: (idx: number) => void;
   setMatchData: (matchData: any) => void;
   setOpponentStats: (stats: ProfileStats | null) => void;
   setCountdownSecs: (secs: number) => void;
   setTimeLeft: (time: number) => void;
   setMaxTime: (time: number) => void;
   setSelectedAnswer: (ans: string | null) => void;
   setRevealAnswers: (reveal: boolean) => void;
   resetGame: () => void;
}

export const useWordUpStore = create<WordUpState>((set) => ({
   view: "menu",
   category: "mixed",
   matchId: null,
   role: null,
   questions: [],
   currentIdx: 0,
   matchData: null,
   opponentStats: null,
   countdownSecs: 6,
   timeLeft: 10.0,
   maxTime: 10.0,
   selectedAnswer: null,
   revealAnswers: false,

   setView: (view) => set({ view }),
   setCategory: (category) => set({ category }),
   setMatchId: (matchId) => set({ matchId }),
   setRole: (role) => set({ role }),
   setQuestions: (questions) => set({ questions }),
   setCurrentIdx: (currentIdx) => set({ currentIdx }),
   setMatchData: (matchData) => set({ matchData }),
   setOpponentStats: (opponentStats) => set({ opponentStats }),
   setCountdownSecs: (countdownSecs) => set({ countdownSecs }),
   setTimeLeft: (timeLeft) => set({ timeLeft }),
   setMaxTime: (maxTime) => set({ maxTime }),
   setSelectedAnswer: (selectedAnswer) => set({ selectedAnswer }),
   setRevealAnswers: (revealAnswers) => set({ revealAnswers }),
   resetGame: () => {
      safeLocalStorage.removeItem("wordup_active_game");
      set({
         view: "menu",
         matchId: null,
         role: null,
         questions: [],
         currentIdx: 0,
         matchData: null,
         opponentStats: null,
         countdownSecs: 6,
         timeLeft: 10.0,
         maxTime: 10.0,
         selectedAnswer: null,
         revealAnswers: false,
      });
   },
}));
