// src/store/useWordUpStore.ts
import { create } from "zustand";
import { type WordUpQuestion } from "../utils/wordupQuestionGenerator";
import { type ProfileStats } from "../components/wordup/WordUpView/types";
import { safeLocalStorage, safeSessionStorage } from "../utils/storage";
import { postProcessQuestions } from "../utils/wordupQuestionPostProcessor";


interface WordUpState {
   isBattlePlaying: boolean;
    view:
       | "menu"
       | "connecting"
       | "matchmaking"
       | "countdown"
       | "battle"
       | "gameover"
       | "loading"
       | "turn_submitted";
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
   setIsBattlePlaying: (playing: boolean) => void;
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
   isBattlePlaying: false,
   view: "menu",
    category: safeSessionStorage.getItem("wordup_selected_category") || "mixed",
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

   setIsBattlePlaying: (playing) => set({ isBattlePlaying: playing }),
   setView: (view) => set({ view }),
    setCategory: (category) => {
       safeSessionStorage.setItem("wordup_selected_category", category);
       set({ category });
    },
   setMatchId: (matchId) => set({ matchId }),
   setRole: (role) => set({ role }),
   setQuestions: (questions) => {
      const category = useWordUpStore.getState().category;
      const processed = postProcessQuestions(questions, category);
      set({ questions: processed });
   },
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
      const state = useWordUpStore.getState();
      set({
         isBattlePlaying: false,
         view: "menu",
         matchId: null,
         role: null,
         questions: state.questions.length > 0 ? [] : state.questions,
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
