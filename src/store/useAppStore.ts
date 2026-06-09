/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from "zustand";
import { type GameStats } from "../types/game";

interface UserPreferences {
   allowRoasts: boolean;
   theme: "dark" | "light";
   compactMode: boolean;
}

const defaultPreferences: UserPreferences = {
   allowRoasts: true,
   theme: "dark",
   compactMode: false,
};

const INITIAL_STATS: GameStats = {
   gamesPlayed: 0,
   gamesWon: 0,
   currentStreak: 0,
   maxStreak: 0,
   guesses: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, X: 0 },
};

export interface VoiceCallState {
   channelId: string;
   type: "private" | "group";
   role: "caller" | "receiver" | "participant";
   targetUser?: { id: string; username: string; avatar_url: string };
   status:
      | "idle"
      | "calling"
      | "ringing"
      | "connecting"
      | "connected"
      | "disconnected"
      | "rejected"
      | "busy"
      | "failed";
}

interface AppState {
   // UI State
   toast: { show: boolean; message: string; duration?: number };
   isChallengeOpen: boolean;
   isNotificationsOpen: boolean;
   isChatOpen: boolean;
       isChatConversationOpen: boolean;
       isLoadingDate: boolean;

   // Auth-related Local State
   preferences: UserPreferences;
   stats: GameStats;
   myParticipations: string[];

   // Social / Real-time State
   unreadCount: number;
   challengeUnreadCount: number;
   activeCall: VoiceCallState | null;
   globalMessages: any[];
   isGlobalMessagesLoaded: boolean;
   readReceipts: Record<string, string>;
   failedMessageIds: string[];
   pendingReadReceipts: Record<string, string>;
   joinedGroupIds: string[];

   // Actions
   triggerToast: (message: string, duration?: number) => void;
   setToast: (toast: {
      show: boolean;
      message: string;
      duration?: number;
   }) => void;
   setChallengeOpen: (val: boolean) => void;
   setNotificationsOpen: (val: boolean) => void;
   setChatOpen: (val: boolean) => void;
       setChatConversationOpen: (val: boolean) => void;
       setUnreadCount: (val: number) => void;
   setChallengeUnreadCount: (val: number) => void;
   setActiveCall: (call: VoiceCallState | null) => void;
   setPreferences: (prefs: UserPreferences) => void;
   setStats: (stats: GameStats) => void;
   setMyParticipations: (ids: string[]) => void;
   setIsLoadingDate: (loading: boolean) => void;
   setGlobalMessages: (messages: any[]) => void;
   addGlobalMessage: (message: any) => void;
   updateGlobalMessage: (message: any) => void;
   setReadReceipts: (receipts: Record<string, string>) => void;
   updateReadReceipt: (groupId: string, timestamp: string) => void;
   addFailedMessageId: (id: string) => void;
   removeFailedMessageId: (id: string) => void;
   setPendingReadReceipts: (receipts: Record<string, string>) => void;
   updatePendingReadReceipt: (groupId: string, timestamp: string) => void;
   removePendingReadReceipt: (groupId: string) => void;
   setJoinedGroupIds: (ids: string[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
   // Initial State
   toast: { show: false, message: "" },
   isChallengeOpen: new URLSearchParams(window.location.search).has(
      "challenge",
   ),
   isNotificationsOpen: false,
   isChatOpen: false,
       isChatConversationOpen: false,
       isLoadingDate: true,
   preferences: defaultPreferences,
   stats: INITIAL_STATS,
   myParticipations: [],
   unreadCount: 0,
   challengeUnreadCount: 0,
   activeCall: null,
   globalMessages: [],
   isGlobalMessagesLoaded: false,
   readReceipts: {},
   failedMessageIds: [],
   joinedGroupIds: [],
   pendingReadReceipts: (() => {
      try {
         const val = localStorage.getItem('pendingReadReceipts');
         return val ? JSON.parse(val) : {};
      } catch {
         return {};
      }
   })(),

   // Actions
   triggerToast: (message, duration = 3000) =>
      set({ toast: { show: true, message, duration } }),
   setToast: (toast) => set({ toast }),
   setChallengeOpen: (isChallengeOpen) => set({ isChallengeOpen }),
   setNotificationsOpen: (isNotificationsOpen) => set({ isNotificationsOpen }),
   setChatOpen: (isChatOpen) => set({ isChatOpen }),
    setChatConversationOpen: (isChatConversationOpen) => set({ isChatConversationOpen }),
   setUnreadCount: (unreadCount) => set({ unreadCount }),
   setChallengeUnreadCount: (challengeUnreadCount) =>
      set({ challengeUnreadCount }),
   setActiveCall: (activeCall) => set({ activeCall }),
   setPreferences: (preferences) => set({ preferences }),
   setStats: (stats) => set({ stats }),
   setMyParticipations: (myParticipations) => set({ myParticipations }),
   setIsLoadingDate: (isLoadingDate) => set({ isLoadingDate }),
   setGlobalMessages: (globalMessages) =>
      set({ globalMessages, isGlobalMessagesLoaded: true }),
   addGlobalMessage: (msg) =>
      set((state) => {
         const exists = state.globalMessages.some((m) => m.id === msg.id);
         if (exists)
            return {
               globalMessages: state.globalMessages.map((m) =>
                  m.id === msg.id ? { ...m, ...msg } : m,
               ),
            };
         return { globalMessages: [...state.globalMessages, msg] };
      }),
   updateGlobalMessage: (msg) =>
      set((state) => ({
         globalMessages: state.globalMessages.map((m) =>
            m.id === msg.id ? { ...m, ...msg } : m,
         ),
      })),
   setReadReceipts: (readReceipts) => set({ readReceipts }),
   updateReadReceipt: (groupId, timestamp) =>
      set((state) => ({
         readReceipts: { ...state.readReceipts, [groupId]: timestamp },
      })),
   addFailedMessageId: (id) => set((state) => ({
      failedMessageIds: [...state.failedMessageIds, id]
   })),
   removeFailedMessageId: (id) => set((state) => ({
      failedMessageIds: state.failedMessageIds.filter((mid) => mid !== id)
   })),
   setPendingReadReceipts: (pendingReadReceipts) => {
      try {
         localStorage.setItem('pendingReadReceipts', JSON.stringify(pendingReadReceipts));
      } catch {}
      set({ pendingReadReceipts });
   },
   updatePendingReadReceipt: (groupId, timestamp) => set((state) => {
      const next = { ...state.pendingReadReceipts, [groupId]: timestamp };
      try {
         localStorage.setItem('pendingReadReceipts', JSON.stringify(next));
      } catch {}
      return { pendingReadReceipts: next };
   }),
   removePendingReadReceipt: (groupId) => set((state) => {
      const next = { ...state.pendingReadReceipts };
      delete next[groupId];
      try {
         localStorage.setItem('pendingReadReceipts', JSON.stringify(next));
      } catch {}
      return { pendingReadReceipts: next };
   }),
   setJoinedGroupIds: (joinedGroupIds) => set({ joinedGroupIds }),
}));
