import { create } from 'zustand';
import { type Challenge, type ChallengeParticipant } from '../hooks/useChallenge';

interface ChallengeState {
    // UI & Navigation
    activeTab: 'my' | 'create' | 'join';
    isPlaying: boolean;
    joinId: string;
    previewParticipant: ChallengeParticipant | null;
    timeLeft: number | null;
    backAction: (() => void) | null;

    // Form State
    mode: 'LIVE' | 'ANYTIME';
    length: number;
    maxTime: number | null;
    invitedIds: string[];

    // Selection State
    selectedChallenge: Challenge | null;
    myParticipation: ChallengeParticipant | null;

    // Search & Filter State
    searchQuery: string;
    statusFilter: 'ALL' | 'ACTIVE' | 'COMPLETED';
    modeFilter: 'ALL' | 'LIVE' | 'ANYTIME';
    lengthFilter: 'ALL' | number;

    // Actions
    setActiveTab: (tab: 'my' | 'create' | 'join') => void;
    setIsPlaying: (playing: boolean) => void;
    setJoinId: (id: string) => void;
    setPreviewParticipant: (p: ChallengeParticipant | null) => void;
    setTimeLeft: (t: number | null) => void;
    setBackAction: (fn: (() => void) | null) => void;
    setMode: (mode: 'LIVE' | 'ANYTIME') => void;
    setLength: (length: number) => void;
    setMaxTime: (time: number | null) => void;
    setInvitedIds: (ids: string[]) => void;
    toggleInvite: (id: string) => void;
    setSelectedChallenge: (c: Challenge | null) => void;
    setMyParticipation: (p: ChallengeParticipant | null) => void;
    setSearchQuery: (q: string) => void;
    setStatusFilter: (f: 'ALL' | 'ACTIVE' | 'COMPLETED') => void;
    setModeFilter: (m: 'ALL' | 'LIVE' | 'ANYTIME') => void;
    setLengthFilter: (l: 'ALL' | number) => void;
    clearFilters: () => void;
    resetForm: () => void;
}

export const useChallengeStore = create<ChallengeState>((set) => ({
    // Initial State
    activeTab: 'my',
    isPlaying: false,
    joinId: '',
    previewParticipant: null,
    timeLeft: null,
    backAction: null,
    mode: 'ANYTIME',
    length: 5,
    maxTime: null,
    invitedIds: [],
    selectedChallenge: null,
    myParticipation: null,
    searchQuery: '',
    statusFilter: 'ALL',
    modeFilter: 'ALL',
    lengthFilter: 'ALL',

    // Actions
    setActiveTab: (activeTab) => set({ activeTab }),
    setIsPlaying: (isPlaying) => set({ isPlaying }),
    setJoinId: (joinId) => set({ joinId }),
    setPreviewParticipant: (previewParticipant) => set({ previewParticipant }),
    setTimeLeft: (timeLeft) => set({ timeLeft }),
    setBackAction: (fn) => set((state) => ({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        backAction: typeof fn === 'function' ? (fn as any)(state.backAction) : fn
    })),
    setMode: (mode) => set({ mode, maxTime: mode === 'LIVE' ? 5 : null }),
    setLength: (length) => set({ length }),
    setMaxTime: (maxTime) => set({ maxTime }),
    setInvitedIds: (invitedIds) => set({ invitedIds }),
    toggleInvite: (id) => set((state) => ({
        invitedIds: state.invitedIds.includes(id)
            ? state.invitedIds.filter(i => i !== id)
            : [...state.invitedIds, id]
    })),
    setSelectedChallenge: (selectedChallenge) => set({ selectedChallenge }),
    setMyParticipation: (myParticipation) => set({ myParticipation }),
    setSearchQuery: (searchQuery) => set({ searchQuery }),
    setStatusFilter: (statusFilter) => set({ statusFilter }),
    setModeFilter: (modeFilter) => set({ modeFilter }),
    setLengthFilter: (lengthFilter) => set({ lengthFilter }),
    clearFilters: () => set({
        searchQuery: '',
        statusFilter: 'ALL',
        modeFilter: 'ALL',
        lengthFilter: 'ALL'
    }),
    resetForm: () => set({
        mode: 'ANYTIME',
        length: 5,
        maxTime: null,
        invitedIds: []
    })
}));
