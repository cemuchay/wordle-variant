/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext, useEffect, useCallback, useMemo, type ReactNode, useRef } from 'react';
import { useChallenge, type Challenge, type ChallengeParticipant } from '../hooks/useChallenge';
import { useApp } from './AppContext';
import { deobfuscateWord } from '../lib/game-logic';
import { supabase } from '../lib/supabaseClient';
import { useChallengeStore } from '../store/useChallengeStore';
import { useMyChallenges, useAvailableProfiles, useChallengeMutations } from '../hooks/queries/useChallengeQueries';
import { useShallow } from 'zustand/react/shallow';

interface ChallengeContextType {
    // UI State
    activeTab: 'my' | 'create' | 'join';
    setActiveTab: (tab: 'my' | 'create' | 'join') => void;
    isPlaying: boolean;
    setIsPlaying: (playing: boolean) => void;

    // Form State
    mode: 'LIVE' | 'ANYTIME';
    setMode: (mode: 'LIVE' | 'ANYTIME') => void;
    length: number;
    setLength: (length: number) => void;
    maxTime: number | null;
    setMaxTime: (time: number | null) => void;

    // Data State
    selectedChallenge: Challenge | null;
    setSelectedChallenge: (c: Challenge | null) => void;
    myParticipation: ChallengeParticipant | null;
    participants: ChallengeParticipant[];
    myChallenges: any[];
    availableProfiles: any[];
    invitedIds: string[];

    // Filter State
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    statusFilter: 'ALL' | 'ACTIVE' | 'COMPLETED';
    setStatusFilter: (f: 'ALL' | 'ACTIVE' | 'COMPLETED') => void;
    modeFilter: 'ALL' | 'LIVE' | 'ANYTIME';
    setModeFilter: (m: 'ALL' | 'LIVE' | 'ANYTIME') => void;
    lengthFilter: 'ALL' | number;
    setLengthFilter: (l: 'ALL' | number) => void;
    clearFilters: () => void;
    filteredChallenges: any[];

    // Actions
    handleViewChallenge: (id: string) => Promise<void>;
    handleCreate: () => Promise<void>;
    handleStartGame: () => Promise<void>;
    toggleInvite: (id: string) => void;
    copyLink: (challenge: Challenge) => void;
    loadMyChallenges: () => Promise<void>;
    submitResult: (result: any, wordLength?: number) => Promise<boolean>;

    // Helpers
    loading: boolean;
    error: string | null;
    joinId: string;
    setJoinId: (id: string) => void;
    submitChallengeResult: any;
    submitMarathonResult: any;
    startChallenge: any;
    previewParticipant: ChallengeParticipant | null;
    setPreviewParticipant: (p: ChallengeParticipant | null) => void;
    unplayedCount: number;
    backAction: (() => void) | null;
    setBackAction: (fn: (() => void) | null) => void;
}

const ChallengeContext = createContext<ChallengeContextType | undefined>(undefined);

export const ChallengeProvider = ({ children, user, onChallengeCreated, initialChallengeId }: {
    children: ReactNode,
    user: any,
    onChallengeCreated?: (challenge: Challenge, invitedUsernames: string[], invitedIds: string[]) => void,
    initialChallengeId?: string | null
}) => {
    const { triggerToast, setChallengeUnreadCount } = useApp();

    // Select stable properties and exclude timeLeft to avoid frequent re-renders
    const store = useChallengeStore(useShallow(state => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { timeLeft, ...rest } = state;
        return rest;
    }));

    // 1. Server Data (TanStack Query)
    const { data: myChallengesData, isLoading: isChallengesLoading, refetch: refetchChallenges } = useMyChallenges(user?.id);
    const { data: profilesData } = useAvailableProfiles(user?.id);
    const { createChallenge: createMutation, submitResult: submitMutation } = useChallengeMutations();

    // 2. Legacy Hook (Used for real-time and specific actions not yet migrated)
    const challengeApi = useChallenge(user);
    const {
        fetchChallenge, joinChallenge, subscribeToParticipants,
        participants, startChallenge, submitChallengeResult, submitMarathonResult
    } = challengeApi;

    const channelRef = useRef<any>(null);
    const initialProcessed = useRef(false);

    // 3. Computed State
    const myChallenges = useMemo(() => myChallengesData || [], [myChallengesData]);
    const availableProfiles = useMemo(() => profilesData || [], [profilesData]);

    const unplayedCount = useMemo(() =>
        myChallenges.filter((c: any) => (c.status === 'pending' || c.status === 'playing') && new Date(c.challenge.expires_at) > new Date()).length,
        [myChallenges]
    );

    useEffect(() => {
        setChallengeUnreadCount(unplayedCount);
    }, [unplayedCount, setChallengeUnreadCount]);

    const filteredChallenges = useMemo(() => {
        return myChallenges.filter((item: any) => {
            const challenge = item.challenge;
            const isExpired = new Date(challenge.expires_at) < new Date();
            const isFinished = item.status === 'completed' || item.status === 'timed_out' || item.status === 'declined';

            if (store.statusFilter === 'ACTIVE' && (isFinished || isExpired)) return false;
            if (store.statusFilter === 'COMPLETED' && !isFinished && !isExpired) return false;
            if (store.modeFilter !== 'ALL' && challenge.mode !== store.modeFilter) return false;
            if (store.lengthFilter !== 'ALL' && challenge.word_length !== store.lengthFilter) return false;

            if (store.searchQuery) {
                const opponentNames = challenge.participants
                    ?.filter((p: any) => p.user_id !== user?.id)
                    .map((p: any) => p.profiles?.username?.toLowerCase() || '')
                    .join(' ');
                if (!opponentNames.includes(store.searchQuery.toLowerCase())) return false;
            }
            return true;
        });
    }, [myChallenges, store.statusFilter, store.modeFilter, store.lengthFilter, store.searchQuery, user?.id]);

    // 4. Action Wrappers
    const cleanupSubscription = useCallback(() => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
    }, []);

    useEffect(() => cleanupSubscription, [cleanupSubscription]);

    const handleViewChallenge = useCallback(async (id: string) => {
        const challenge = await fetchChallenge(id);
        if (challenge) {
            if (new Date(challenge.expires_at) < new Date()) {
                triggerToast("This challenge has expired.", 4000);
                return;
            }
            cleanupSubscription();
            store.setSelectedChallenge(challenge);
            const participation = await joinChallenge(challenge.id);
            store.setMyParticipation(participation);
            store.setActiveTab('join');
            channelRef.current = subscribeToParticipants(challenge.id);
        } else {
            triggerToast("Invalid challenge link or code.", 4000);
        }
    }, [cleanupSubscription, triggerToast, fetchChallenge, joinChallenge, subscribeToParticipants, store]);

    const handleCreate = useCallback(async () => {
        const challenge = await createMutation.mutateAsync({
            creatorId: user.id,
            mode: store.mode,
            length: store.length,
            maxTime: store.mode === 'LIVE' ? store.maxTime : null,
            invitedIds: store.invitedIds
        });

        if (challenge) {
            const invitedUsernames = availableProfiles
                .filter(p => store.invitedIds.includes(p.id))
                .map(p => p.username);

            if (onChallengeCreated) onChallengeCreated(challenge, invitedUsernames, store.invitedIds);

            store.resetForm();
            handleViewChallenge(challenge.id);
        }
    }, [store, user, availableProfiles, createMutation, onChallengeCreated, handleViewChallenge]);

    const handleStartGame = useCallback(async () => {
        if (!store.selectedChallenge || !store.myParticipation) return;

        const updatedChallenge = { ...store.selectedChallenge };

        if (store.selectedChallenge.word_length === 1) {
            try {
                const obfuscatedWords = JSON.parse(store.selectedChallenge.target_word);
                const plainWords: Record<number, string> = {};
                Object.entries(obfuscatedWords).forEach(([len, word]) => {
                    plainWords[Number(len)] = deobfuscateWord(word as string, store.selectedChallenge!.salt);
                });
                updatedChallenge.target_word = JSON.stringify(plainWords);
            } catch (e) {
                console.error("Failed to parse marathon words", e);
            }
        } else {
            updatedChallenge.target_word = deobfuscateWord(store.selectedChallenge.target_word, store.selectedChallenge.salt);
        }

        store.setSelectedChallenge(updatedChallenge);
        if (store.myParticipation.status === 'pending') await startChallenge(store.myParticipation.id);
        store.setIsPlaying(true);
    }, [store, startChallenge]);

    const submitResult = useCallback(async (result: any, wordLength?: number) => {
        if (!store.myParticipation) return false;

        const isMarathon = store.selectedChallenge?.word_length === 1;
        let finalUpdateData: any;

        if (isMarathon && wordLength) {
            const success = await submitMarathonResult(store.myParticipation.id, wordLength, result);
            if (!success) return false;

            const currentMarathon = store.myParticipation.marathon_progress || [];
            const updatedMarathon = [...currentMarathon];
            const idx = updatedMarathon.findIndex(p => p.word_length === wordLength);

            if (idx > -1) {
                updatedMarathon[idx] = { ...updatedMarathon[idx], ...result };
            } else {
                updatedMarathon.push({ word_length: wordLength, ...result } as any);
            }

            let totalScore = 0;
            let totalAttempts = 0;
            let totalTimeTaken = 0;
            let completedCount = 0;
            const lengths = [3, 4, 5, 6, 7];

            lengths.forEach(l => {
                const prog = updatedMarathon.find(p => p.word_length === l);
                if (prog) {
                    totalAttempts += prog.attempts || 0;
                    totalTimeTaken += prog.time_taken || 0;
                    if (prog.status === 'completed' || prog.status === 'timed_out') {
                        totalScore += prog.score || 0;
                        completedCount++;
                    }
                }
            });

            const allCompleted = completedCount === 5;
            finalUpdateData = {
                score: totalScore,
                attempts: totalAttempts,
                time_taken: totalTimeTaken,
                status: allCompleted ? 'completed' : 'playing',
                hints_used: updatedMarathon.some(p => p.hints_used),
                marathon_progress: updatedMarathon
            };
        } else {
            finalUpdateData = { ...result };
        }

        store.setMyParticipation(store.myParticipation ? { ...store.myParticipation, ...finalUpdateData } : null);
        return await submitMutation.mutateAsync({ participationId: store.myParticipation.id, result: finalUpdateData });
    }, [store, submitMarathonResult, submitMutation]);

    // Initial Load Logic
    useEffect(() => {
        if (initialChallengeId && !initialProcessed.current) {
            initialProcessed.current = true;
            handleViewChallenge(initialChallengeId);
        }
    }, [initialChallengeId, handleViewChallenge]);

    // Context Value (Bridge)
    const contextValue: ChallengeContextType = useMemo(() => ({
        activeTab: store.activeTab,
        setActiveTab: store.setActiveTab,
        isPlaying: store.isPlaying,
        setIsPlaying: store.setIsPlaying,
        mode: store.mode,
        setMode: store.setMode,
        length: store.length,
        setLength: store.setLength,
        maxTime: store.maxTime,
        setMaxTime: store.setMaxTime,
        selectedChallenge: store.selectedChallenge,
        setSelectedChallenge: store.setSelectedChallenge,
        myParticipation: store.myParticipation,
        participants,
        myChallenges,
        availableProfiles,
        invitedIds: store.invitedIds,
        searchQuery: store.searchQuery,
        setSearchQuery: store.setSearchQuery,
        statusFilter: store.statusFilter,
        setStatusFilter: store.setStatusFilter,
        modeFilter: store.modeFilter,
        setModeFilter: store.setModeFilter,
        lengthFilter: store.lengthFilter,
        setLengthFilter: store.setLengthFilter,
        clearFilters: store.clearFilters,
        filteredChallenges,
        handleViewChallenge,
        handleCreate,
        handleStartGame,
        toggleInvite: store.toggleInvite,
        copyLink: (c: Challenge) => {
            const url = `${window.location.origin}${window.location.pathname}?challenge=${c.id}`;
            const text = `Hey! I challenge you to a ${c.word_length === 1 ? 'Marathon' : c.word_length + '-letter Wordle'} match (${c.mode} mode)! 🏆\n\nJoin here: ${url}`;
            navigator.clipboard.writeText(text);
            triggerToast('Challenge link copied to clipboard!', 2000);
        },
        loadMyChallenges: async () => { await refetchChallenges(); },
        submitResult,
        loading: isChallengesLoading || createMutation.isPending || submitMutation.isPending,
        error: null,
        joinId: store.joinId,
        setJoinId: store.setJoinId,
        submitChallengeResult,
        submitMarathonResult,
        startChallenge,
        previewParticipant: store.previewParticipant,
        setPreviewParticipant: store.setPreviewParticipant,
        unplayedCount,
        backAction: store.backAction,
        setBackAction: store.setBackAction
    }), [store, participants, myChallenges, availableProfiles, filteredChallenges, handleViewChallenge, handleCreate, handleStartGame, triggerToast, refetchChallenges, submitResult, isChallengesLoading, createMutation.isPending, submitMutation.isPending, submitChallengeResult, submitMarathonResult, startChallenge, unplayedCount]);

    return (
        <ChallengeContext.Provider value={contextValue}>
            {children}
        </ChallengeContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useChallengeContext = () => {
    const context = useContext(ChallengeContext);
    if (context === undefined) {
        throw new Error('useChallengeContext must be used within a ChallengeProvider');
    }
    return context;
};
