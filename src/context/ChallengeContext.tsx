/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext, useEffect, useCallback, useMemo, type ReactNode, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
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
    const queryClient = useQueryClient();

    // Select stable properties and exclude timeLeft to avoid frequent re-renders
    const store = useChallengeStore(useShallow(state => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { timeLeft, ...rest } = state;
        return rest;
    }));

    // 1. Server Data (TanStack Query)
    const { data: myChallengesData, isLoading: isChallengesLoading, refetch: refetchChallenges } = useMyChallenges(user?.id);
    const { data: profilesData } = useAvailableProfiles(user?.id);
    const {
        createChallenge: createMutation,
        submitResult: submitMutation,
        joinChallenge: joinMutation,
        startChallenge: startMutation,
        submitMarathonResult: marathonMutation
    } = useChallengeMutations();

    // 2. Legacy Hook (Keep for real-time logic only)
    const challengeApi = useChallenge(user);
    const { subscribeToParticipants, participants } = challengeApi;

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

    const normalizeParticipation = useCallback((p: any, challenge: any) => {
        if (!p || !challenge) return p;
        if (challenge.mode !== 'LIVE' || !challenge.max_time || p.status !== 'playing' || !p.started_at) return p;

        const start = new Date(p.started_at).getTime();
        const now = Date.now();
        const limitMs = (challenge.max_time * 60 * 1000) + (2 * 60 * 1000); // 2 min buffer

        if (now - start > limitMs) {
            return { ...p, status: 'timed_out' as const };
        }
        return p;
    }, []);

    const handleViewChallenge = useCallback(async (id: string) => {
        // Manual fetch using TanStack Query's queryClient to maintain cache and consistency
        const challenge = await queryClient.fetchQuery({
            queryKey: ['challenge', id],
            queryFn: async () => {
                const { data, error } = await supabase
                    .from('challenges')
                    .select(`
                        *, 
                        profiles!creator_id(username, avatar_url),
                        participants:challenge_participants(
                            *,
                            profiles(username, avatar_url),
                            marathon_progress:challenge_participants_marathon(*)
                        )
                    `)
                    .eq('id', id)
                    .maybeSingle();

                if (error) throw error;
                if (data) {
                    const c = data as any;
                    c.participants = c.participants.map((p: any) => normalizeParticipation(p, c));
                    return c as Challenge;
                }
                return null;
            }
        });

        if (challenge) {
            if (new Date(challenge.expires_at) < new Date()) {
                triggerToast("This challenge has expired.", 4000);
                return;
            }
            cleanupSubscription();
            store.setSelectedChallenge(challenge);

            const participation = await joinMutation.mutateAsync({ challengeId: challenge.id, userId: user.id });
            const normalizedPart = normalizeParticipation(participation, challenge);

            store.setMyParticipation(normalizedPart);
            store.setActiveTab('join');
            channelRef.current = subscribeToParticipants(challenge.id);
        } else {
            triggerToast("Invalid challenge link or code.", 4000);
        }
    }, [queryClient, normalizeParticipation, triggerToast, cleanupSubscription, store, joinMutation, user.id, subscribeToParticipants]);

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
        if (store.myParticipation.status === 'pending') {
            await startMutation.mutateAsync(store.myParticipation.id);
        }
        store.setIsPlaying(true);
    }, [store, startMutation]);

    const submitResult = useCallback(async (result: any, wordLength?: number) => {
        if (!store.myParticipation) return false;

        const isMarathon = store.selectedChallenge?.word_length === 1;
        let finalUpdateData: any;

        if (isMarathon && wordLength) {
            const success = await marathonMutation.mutateAsync({
                participationId: store.myParticipation.id,
                wordLength,
                result
            });
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
                hints_used: updatedMarathon.some(p => p.hints_used)
            };

            // Update local state with the full progress object for UI consistency
            store.setMyParticipation(store.myParticipation ? { 
                ...store.myParticipation, 
                ...finalUpdateData,
                marathon_progress: updatedMarathon 
            } : null);
        } else {
            finalUpdateData = { ...result };
            store.setMyParticipation(store.myParticipation ? { ...store.myParticipation, ...finalUpdateData } : null);
        }

        return await submitMutation.mutateAsync({ participationId: store.myParticipation.id, result: finalUpdateData });
    }, [store, marathonMutation, submitMutation]);

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
        loading: isChallengesLoading || createMutation.isPending || submitMutation.isPending || joinMutation.isPending || startMutation.isPending || marathonMutation.isPending,
        error: null,
        joinId: store.joinId,
        setJoinId: store.setJoinId,
        previewParticipant: store.previewParticipant,
        setPreviewParticipant: store.setPreviewParticipant,
        unplayedCount,
        backAction: store.backAction,
        setBackAction: store.setBackAction
    }), [store, participants, myChallenges, availableProfiles, filteredChallenges, handleViewChallenge, handleCreate, handleStartGame, triggerToast, refetchChallenges, submitResult, isChallengesLoading, createMutation.isPending, submitMutation.isPending, joinMutation.isPending, startMutation.isPending, marathonMutation.isPending, unplayedCount]);

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
