import { create } from 'zustand';
import { type GameStats } from '../types/game';

interface UserPreferences {
    allowRoasts: boolean;
    theme: 'dark' | 'light';
    compactMode: boolean;
}

const defaultPreferences: UserPreferences = {
    allowRoasts: true,
    theme: 'dark',
    compactMode: false,
};

const INITIAL_STATS: GameStats = {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    guesses: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, X: 0 },
};

interface AppState {
    // UI State
    toast: { show: boolean; message: string; duration?: number };
    isChallengeOpen: boolean;
    isChatOpen: boolean;
    isLoadingDate: boolean;
    
    // Auth-related Local State
    preferences: UserPreferences;
    stats: GameStats;
    myParticipations: string[];
    
    // Social / Real-time State
    unreadCount: number;
    challengeUnreadCount: number;
    activeCall: { challengeId: string; userId: string; isInitiator?: boolean } | null;

    // Actions
    triggerToast: (message: string, duration?: number) => void;
    setToast: (toast: { show: boolean; message: string; duration?: number }) => void;
    setChallengeOpen: (val: boolean) => void;
    setChatOpen: (val: boolean) => void;
    setUnreadCount: (val: number) => void;
    setChallengeUnreadCount: (val: number) => void;
    setActiveCall: (call: { challengeId: string; userId: string; isInitiator?: boolean } | null) => void;
    setPreferences: (prefs: UserPreferences) => void;
    setStats: (stats: GameStats) => void;
    setMyParticipations: (ids: string[]) => void;
    setIsLoadingDate: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
    // Initial State
    toast: { show: false, message: "" },
    isChallengeOpen: new URLSearchParams(window.location.search).has('challenge'),
    isChatOpen: false,
    isLoadingDate: true,
    preferences: defaultPreferences,
    stats: INITIAL_STATS,
    myParticipations: [],
    unreadCount: 0,
    challengeUnreadCount: 0,
    activeCall: null,

    // Actions
    triggerToast: (message, duration) => set({ toast: { show: true, message, duration } }),
    setToast: (toast) => set({ toast }),
    setChallengeOpen: (isChallengeOpen) => set({ isChallengeOpen }),
    setChatOpen: (isChatOpen) => set({ isChatOpen }),
    setUnreadCount: (unreadCount) => set({ unreadCount }),
    setChallengeUnreadCount: (challengeUnreadCount) => set({ challengeUnreadCount }),
    setActiveCall: (activeCall) => set({ activeCall }),
    setPreferences: (preferences) => set({ preferences }),
    setStats: (stats) => set({ stats }),
    setMyParticipations: (myParticipations) => set({ myParticipations }),
    setIsLoadingDate: (isLoadingDate) => set({ isLoadingDate }),
}));
