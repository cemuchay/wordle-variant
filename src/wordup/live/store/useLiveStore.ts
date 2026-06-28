import { create } from "zustand";
import { type WordUpQuestion } from "../../../utils/wordupQuestionGenerator";
import { type ProfileStats } from "../../shared/types";
import { safeLocalStorage, safeSessionStorage } from "../../../utils/storage";
import { postProcessQuestions } from "../../../utils/wordupQuestionPostProcessor";

type LiveTab = "play" | "rankings" | "history";

interface LiveState {
   isBattlePlaying: boolean;
   activeTab: LiveTab;
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

   setIsBattlePlaying: (playing: boolean) => void;
   setView: (view: "menu" | "connecting" | "matchmaking" | "countdown" | "battle" | "gameover" | "loading") => void;
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
   setActiveTab: (tab: LiveTab) => void;
   resetGame: () => void;
}

export const useLiveStore = create<LiveState>((set) => ({
   isBattlePlaying: false,
   activeTab: (safeSessionStorage.getItem("wordup_live_tab") as LiveTab) || "play",
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
      const category = useLiveStore.getState().category;
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
   setActiveTab: (activeTab) => {
      safeSessionStorage.setItem("wordup_live_tab", activeTab);
      set({ activeTab });
   },
   resetGame: () => {
      safeLocalStorage.removeItem("wordup_active_game");
      const state = useLiveStore.getState();
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
