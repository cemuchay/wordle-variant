/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext } from 'react';
import type { Challenge, ChallengeParticipant } from '../hooks/useChallenge';

export interface ChallengeContextType {
    activeTab: 'my' | 'create' | 'join';
    setActiveTab: (tab: 'my' | 'create' | 'join') => void;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;
    isEditingChallenge: boolean;
    setIsEditingChallenge: (editing: boolean) => void;

    // Form State
    mode: 'LIVE' | 'ANYTIME';
    setMode: (mode: 'LIVE' | 'ANYTIME') => void;
    length: number;
    setLength: (length: number) => void;
    maxAttempts: number;
    setMaxAttempts: (attempts: number) => void;
    maxTime: number | null;
    setMaxTime: (time: number | null) => void;

    // Data State
    selectedChallenge: Challenge | null;
    setSelectedChallenge: (c: Challenge | null) => void;
    myParticipation: ChallengeParticipant | null;
    setMyParticipation: (p: ChallengeParticipant | null) => void;
    participants: ChallengeParticipant[];
    myChallenges: any[];
    availableProfiles: any[];
    invitedIds: string[];
    setInvitedIds: (ids: string[]) => void;

    // Filter State
    listColumn: 'unplayed' | 'played';
    setListColumn: (col: 'unplayed' | 'played') => void;

    // Actions
    handleViewChallenge: (id: string) => Promise<void>;
    handleCreate: (params?: any, viewAfterCreate?: boolean) => Promise<void>;
    handleEdit: (challengeId: string, params: any) => Promise<void>;
    handleDelete: (challengeId: string) => Promise<void>;
    handleStartGame: () => Promise<void>;
    toggleInvite: (id: string) => void;
    copyLink: (challenge: Challenge) => void;
    shareLink: (challenge: Challenge) => Promise<void>;
    loadMyChallenges: () => Promise<void>;
    submitResult: (result: any, wordLength?: number, gameIndex?: number) => Promise<boolean>;
    registerAnonymousUser: (nickname: string) => Promise<any>;

    // Helpers
    loading: boolean;
    isBackgroundFetching: boolean;
    error: string | null;
    joinId: string;
    setJoinId: (id: string) => void;
    previewParticipant: ChallengeParticipant | null;
    setPreviewParticipant: (p: ChallengeParticipant | null) => void;
    previewMarathonLength: number | null;
    setPreviewMarathonLength: (l: number | null) => void;
    previewMarathonGameIndex: number | null;
    setPreviewMarathonGameIndex: (idx: number | null) => void;
    backAction: (() => void) | null;
    setBackAction: (fn: (() => void) | null) => void;
    activeGameLength: number | null;
    effectiveUser: any;
    loadingParticipants: boolean;
    participantsError: string | null;
    retryFetchParticipants: () => void;
    dailyMarathonChallenges: any[];
    initialChallengeId?: string | null | undefined;
    bootstrappingMessage: string | null;
    setBootstrappingMessage: (msg: string | null) => void;
}

export const ChallengeContext = createContext<ChallengeContextType | undefined>(undefined);

export const useChallengeContext = () => {
    const context = useContext(ChallengeContext);
    if (context === undefined) {
        throw new Error('useChallengeContext must be used within a ChallengeProvider');
    }
    return context;
};
