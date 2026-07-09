import { create } from "zustand";
import { type WordUpQuestion } from "../../../utils/wordupQuestionGenerator";
import { type ProfileStats } from "../../shared/types";
import { safeLocalStorage, safeSessionStorage } from "../../../utils/storage";
import { postProcessQuestions } from "../../../utils/wordupQuestionPostProcessor";

type AsyncView = "menu" | "loading" | "countdown" | "battle" | "turn_submitted" | "gameover";
type AsyncTab = "play" | "pending" | "history";

interface AsyncState {
   isBattlePlaying: boolean;
   activeTab: AsyncTab;
   view: AsyncView;
   category: string;
   matchId: string | null;
   role: "player1" | "player2" | null;
   questions: WordUpQuestion[];
   currentIdx: number;
   matchData: any;
   opponentStats: ProfileStats | null;
   selectedAnswer: string | null;
   revealAnswers: boolean;
   timeLeft: number;
   maxTime: number;

   setIsBattlePlaying: (playing: boolean) => void;
   setView: (view: AsyncView) => void;
   setCategory: (category: string) => void;
   setMatchId: (matchId: string | null) => void;
   setRole: (role: "player1" | "player2" | null) => void;
   setQuestions: (questions: WordUpQuestion[]) => void;
   setCurrentIdx: (idx: number) => void;
   setMatchData: (matchData: any) => void;
   setOpponentStats: (stats: ProfileStats | null) => void;
   setSelectedAnswer: (ans: string | null) => void;
   setRevealAnswers: (reveal: boolean) => void;
   setTimeLeft: (time: number) => void;
   setMaxTime: (time: number) => void;
   setActiveTab: (tab: AsyncTab) => void;
   resetGame: () => void;
}

export const useAsyncStore = create<AsyncState>((set) => ({
   isBattlePlaying: false,
   activeTab: (safeSessionStorage.getItem("wordup_async_tab") as AsyncTab) || "play",
   view: "menu",
   category: safeLocalStorage.getItem("wordup_selected_category") || "mixed",
   matchId: null,
   role: null,
   questions: [],
   currentIdx: 0,
   matchData: null,
   opponentStats: null,
   selectedAnswer: null,
   revealAnswers: false,
   timeLeft: 10.0,
   maxTime: 10.0,

   setIsBattlePlaying: (playing) => set({ isBattlePlaying: playing }),
   setView: (view) => set({ view }),
   setCategory: (category) => {
      safeLocalStorage.setItem("wordup_selected_category", category);
      set({ category });
   },
   setMatchId: (matchId) => set({ matchId }),
   setRole: (role) => set({ role }),
   setQuestions: (questions) => {
      const category = useAsyncStore.getState().category;
      const processed = postProcessQuestions(questions, category);
      set({ questions: processed });
   },
   setCurrentIdx: (currentIdx) => set({ currentIdx }),
   setMatchData: (matchData) => set({ matchData }),
   setOpponentStats: (opponentStats) => set({ opponentStats }),
   setSelectedAnswer: (selectedAnswer) => set({ selectedAnswer }),
   setRevealAnswers: (revealAnswers) => set({ revealAnswers }),
   setTimeLeft: (timeLeft) => set({ timeLeft }),
   setMaxTime: (maxTime) => set({ maxTime }),
   setActiveTab: (activeTab) => {
      safeSessionStorage.setItem("wordup_async_tab", activeTab);
      set({ activeTab });
   },
   resetGame: () => {
      safeLocalStorage.removeItem("wordup_async_active_game");
      set({
         isBattlePlaying: false,
         view: "menu",
         matchId: null,
         role: null,
         questions: [],
         currentIdx: 0,
         matchData: null,
         opponentStats: null,
         selectedAnswer: null,
         revealAnswers: false,
      });
   },
}));
