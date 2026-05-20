/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAvailableProfiles, useChallengeMutations, useMyChallenges } from '../hooks/queries/useChallengeQueries';
import { useChallenge, type Challenge, type ChallengeParticipant } from '../hooks/useChallenge';
import { supabase } from '../lib/supabaseClient';
import { useChallengeStore } from '../store/useChallengeStore';
import { useApp } from './AppContext';

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
    handleCreate: (params?: any) => Promise<void>;
    handleStartGame: () => Promise<void>;
    toggleInvite: (id: string) => void;
    copyLink: (challenge: Challenge) => void;
    shareLink: (challenge: Challenge) => Promise<void>;
    loadMyChallenges: () => Promise<void>;
    submitResult: (result: any, wordLength?: number) => Promise<boolean>;
    registerAnonymousUser: (nickname: string) => Promise<any>;

    // Helpers
    loading: boolean;
    error: string | null;
    joinId: string;
    setJoinId: (id: string) => void;
    previewParticipant: ChallengeParticipant | null;
    setPreviewParticipant: (p: ChallengeParticipant | null) => void;
    previewMarathonLength: number | null;
    setPreviewMarathonLength: (l: number | null) => void;
    unplayedCount: number;
    backAction: (() => void) | null;
    setBackAction: (fn: (() => void) | null) => void;
    effectiveUser: any;
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

    // Anonymous / Guest User Support
    const [anonUser, setAnonUser] = useState<any>(() => {
        const id = localStorage.getItem('wordle_anon_id');
        const username = localStorage.getItem('wordle_anon_username');
        if (id && username) {
            return { id, username, user_metadata: { full_name: username } };
        }
        return null;
    });

    const effectiveUser = useMemo(() => {
        if (user) return user;
        return anonUser;
    }, [user, anonUser]);

    // 1. Store State & Actions (Destructured for stability)
    const activeTab = useChallengeStore(s => s.activeTab);
    const setActiveTab = useChallengeStore(s => s.setActiveTab);
    const isPlaying = useChallengeStore(s => s.isPlaying);
    const setIsPlaying = useChallengeStore(s => s.setIsPlaying);
    const mode = useChallengeStore(s => s.mode);
    const setMode = useChallengeStore(s => s.setMode);
    const length = useChallengeStore(s => s.length);
    const setLength = useChallengeStore(s => s.setLength);
    const maxTime = useChallengeStore(s => s.maxTime);
    const setMaxTime = useChallengeStore(s => s.setMaxTime);
    const selectedChallenge = useChallengeStore(s => s.selectedChallenge);
    const setSelectedChallenge = useChallengeStore(s => s.setSelectedChallenge);
    const myParticipation = useChallengeStore(s => s.myParticipation);
    const setMyParticipation = useChallengeStore(s => s.setMyParticipation);
    const invitedIds = useChallengeStore(s => s.invitedIds);
    // const setInvitedIds = useChallengeStore(s => s.setInvitedIds);
    const toggleInvite = useChallengeStore(s => s.toggleInvite);
    const searchQuery = useChallengeStore(s => s.searchQuery);
    const setSearchQuery = useChallengeStore(s => s.setSearchQuery);
    const statusFilter = useChallengeStore(s => s.statusFilter);
    const setStatusFilter = useChallengeStore(s => s.setStatusFilter);
    const modeFilter = useChallengeStore(s => s.modeFilter);
    const setModeFilter = useChallengeStore(s => s.setModeFilter);
    const lengthFilter = useChallengeStore(s => s.lengthFilter);
    const setLengthFilter = useChallengeStore(s => s.setLengthFilter);
    const clearFilters = useChallengeStore(s => s.clearFilters);
    const resetForm = useChallengeStore(s => s.resetForm);
    const joinId = useChallengeStore(s => s.joinId);
    const setJoinId = useChallengeStore(s => s.setJoinId);
    const previewParticipant = useChallengeStore(s => s.previewParticipant);
    const setPreviewParticipant = useChallengeStore(s => s.setPreviewParticipant);
    const previewMarathonLength = useChallengeStore(s => s.previewMarathonLength);
    const setPreviewMarathonLength = useChallengeStore(s => s.setPreviewMarathonLength);
    const backAction = useChallengeStore(s => s.backAction);
    const setBackAction = useChallengeStore(s => s.setBackAction);

    // 1. Server Data (TanStack Query)
    const { data: myChallengesData, isLoading: isChallengesLoading, refetch: refetchChallenges } = useMyChallenges(effectiveUser?.id);
    const { data: profilesData } = useAvailableProfiles(effectiveUser?.id);
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

            if (statusFilter === 'ACTIVE' && (isFinished || isExpired)) return false;
            if (statusFilter === 'COMPLETED' && !isFinished && !isExpired) return false;
            if (modeFilter !== 'ALL' && challenge.mode !== modeFilter) return false;
            if (lengthFilter !== 'ALL' && challenge.word_length !== lengthFilter) return false;

            if (searchQuery) {
                const opponentNames = challenge.participants
                    ?.filter((p: any) => p.user_id !== effectiveUser?.id)
                    .map((p: any) => p.profiles?.username?.toLowerCase() || '')
                    .join(' ');
                if (!opponentNames.includes(searchQuery.toLowerCase())) return false;
            }
            return true;
        });
    }, [myChallenges, statusFilter, modeFilter, lengthFilter, searchQuery, effectiveUser?.id]);

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
        // Marathon mode uses per-word timers, bypass global LIVE timeout
        if (challenge.word_length === 1) return p;

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
        // 1. Check local cache (myChallenges) for immediate display
        const localMatch = myChallenges.find((item: any) => item.challenge_id === id || item.challenge?.id === id);

        if (localMatch && localMatch.challenge) {
            const cachedChallenge = { ...localMatch.challenge };
            cachedChallenge.participants = cachedChallenge.participants?.map((p: any) => normalizeParticipation(p, cachedChallenge)) || [];

            setSelectedChallenge(cachedChallenge);
            setMyParticipation(normalizeParticipation(localMatch, cachedChallenge));
            setActiveTab('join');
        } else {
            if (selectedChallenge?.id !== id) {
                setSelectedChallenge(null);
                setMyParticipation(null);
            }
        }

        // 2. Background Refresh / Fetch Detailed Data
        try {
            const challengePromise = queryClient.fetchQuery({
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

            let challenge = localMatch?.challenge;
            if (!challenge) {
                challenge = await challengePromise;
            }

            if (challenge) {
                if (new Date(challenge.expires_at) < new Date()) {
                    triggerToast("This challenge has expired.", 4000);
                    return;
                }

                cleanupSubscription();
                setSelectedChallenge(challenge);
                setActiveTab('join');

                // If user is authenticated or has guest ID, load/join participation
                if (effectiveUser) {
                    const isCreatorOfCustom = challenge.creator_id === effectiveUser.id && challenge.is_custom_word;
                    if (!isCreatorOfCustom) {
                        const participationPromise = joinMutation.mutateAsync({ challengeId: challenge.id, userId: effectiveUser.id });

                        let participation = localMatch;
                        if (!participation) {
                            participation = await participationPromise;
                        } else {
                            participationPromise.then(p => {
                                setMyParticipation(normalizeParticipation(p, challenge));
                            });
                        }

                        const normalizedPart = normalizeParticipation(participation, challenge);
                        setMyParticipation(normalizedPart);
                    } else {
                        setMyParticipation(null);
                    }
                } else {
                    setMyParticipation(null);
                }

                channelRef.current = subscribeToParticipants(challenge.id);
            } else {
                triggerToast("Invalid challenge link or code.", 4000);
            }
        } catch (err: any) {
            console.error("Failed to load challenge details", err);
            triggerToast(err?.message || "Failed to load challenge details.", 4000);
        }
    }, [myChallenges, normalizeParticipation, setSelectedChallenge, setMyParticipation, setActiveTab, selectedChallenge?.id, queryClient, cleanupSubscription, joinMutation, effectiveUser, subscribeToParticipants, triggerToast]);

    const joinSelectedChallenge = useCallback(async () => {
        if (!selectedChallenge || !effectiveUser) return;
        try {
            const isCreatorOfCustom = selectedChallenge.creator_id === effectiveUser.id && selectedChallenge.is_custom_word;
            if (isCreatorOfCustom) {
                setMyParticipation(null);
                return;
            }

            const participation = await joinMutation.mutateAsync({
                challengeId: selectedChallenge.id,
                userId: effectiveUser.id
            });
            const normalizedPart = normalizeParticipation(participation, selectedChallenge);
            setMyParticipation(normalizedPart);
        } catch (err: any) {
            console.error("Failed to join challenge:", err);
            triggerToast(err?.message || "Failed to join challenge.", 4000);
        }
    }, [selectedChallenge, effectiveUser, joinMutation, normalizeParticipation, triggerToast, setMyParticipation]);

    const registerAnonymousUser = useCallback(async (nickname: string) => {
        let anonId = localStorage.getItem('wordle_anon_id');
        if (!anonId) {
            anonId = crypto.randomUUID();
            localStorage.setItem('wordle_anon_id', anonId);
        }
        localStorage.setItem('wordle_anon_username', nickname);

        // Insert/update profile in database
        const { error } = await supabase.from('profiles').upsert({
            id: anonId,
            username: nickname,
            avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${anonId}`
        });
        if (error) {
            console.error("Error creating guest profile:", error);
        }

        const newUser = { id: anonId, username: nickname, user_metadata: { full_name: nickname } };
        setAnonUser(newUser);
        return newUser;
    }, []);

    // Auto-join when selectedChallenge is active and effectiveUser becomes available
    useEffect(() => {
        if (selectedChallenge && effectiveUser && !myParticipation && !joinMutation.isPending) {
            const isCreatorOfCustom = selectedChallenge.creator_id === effectiveUser.id && selectedChallenge.is_custom_word;
            if (!isCreatorOfCustom) {
                const alreadyParticipant = selectedChallenge.participants?.find((p: any) => p.user_id === effectiveUser.id);
                if (alreadyParticipant) {
                    setMyParticipation(normalizeParticipation(alreadyParticipant, selectedChallenge));
                } else {
                    joinSelectedChallenge();
                }
            }
        }
    }, [selectedChallenge, effectiveUser, myParticipation, joinSelectedChallenge, normalizeParticipation, joinMutation.isPending, setMyParticipation]);

    const handleCreate = useCallback(async (customParams?: any) => {
        if (!effectiveUser) return;
        const challenge = await createMutation.mutateAsync({
            creatorId: effectiveUser.id,
            mode: mode,
            length: length,
            maxTime: mode === 'LIVE' ? maxTime : null,
            invitedIds: invitedIds,
            ...customParams
        });

        if (challenge) {
            const invitedUsernames = availableProfiles
                .filter(p => invitedIds.includes(p.id))
                .map(p => p.username);

            if (onChallengeCreated) onChallengeCreated(challenge, invitedUsernames, invitedIds);

            resetForm();
            handleViewChallenge(challenge.id);
        }
    }, [mode, length, maxTime, invitedIds, effectiveUser, createMutation, availableProfiles, onChallengeCreated, resetForm, handleViewChallenge]);

    const handleStartGame = useCallback(async () => {
        if (!selectedChallenge || !myParticipation) return;

        if (myParticipation.status === 'pending') {
            await startMutation.mutateAsync(myParticipation.id);
        }
        setIsPlaying(true);
    }, [selectedChallenge, myParticipation, startMutation, setIsPlaying]);

    const submitResult = useCallback(async (result: any, wordLength?: number) => {
        if (!myParticipation) return false;

        const isMarathon = selectedChallenge?.word_length === 1;

        if (isMarathon && wordLength) {
            const isWordFinished = result.status !== 'playing';

            // 1. Always update the specific word progress
            const marathonPromise = marathonMutation.mutateAsync({
                participationId: myParticipation.id,
                wordLength,
                result
            });

            // If not finishing the word, we can just wait for the marathon update
            if (!isWordFinished) {
                const success = await marathonPromise;
                if (!success) return false;

                // Update local state for immediate UI feedback without full re-fetch
                const currentMarathon = myParticipation.marathon_progress || [];
                const updatedMarathon = [...currentMarathon];
                const idx = updatedMarathon.findIndex(p => p.word_length === wordLength);
                if (idx > -1) updatedMarathon[idx] = { ...updatedMarathon[idx], ...result };
                else updatedMarathon.push({ word_length: wordLength, ...result } as any);

                setMyParticipation({ ...myParticipation, marathon_progress: updatedMarathon });
                return true;
            }

            // 2. Word finished: Calculate aggregates and update main participation
            const currentMarathon = myParticipation.marathon_progress || [];
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
            const finalUpdateData = {
                score: totalScore,
                attempts: totalAttempts,
                time_taken: totalTimeTaken,
                status: (allCompleted ? 'completed' : 'playing') as 'completed' | 'playing',
                hints_used: updatedMarathon.some(p => p.hints_used)
            };

            // Run both updates in parallel for better performance
            const [mSuccess, sSuccess] = await Promise.all([
                marathonPromise,
                submitMutation.mutateAsync({ participationId: myParticipation.id, result: finalUpdateData })
            ]);

            if (mSuccess && sSuccess) {
                setMyParticipation({
                    ...myParticipation,
                    ...finalUpdateData,
                    marathon_progress: updatedMarathon
                });
                return true;
            }
            return false;
        } else {
            // Regular Challenge Mode
            const success = await submitMutation.mutateAsync({ participationId: myParticipation.id, result });
            if (success) {
                setMyParticipation(myParticipation ? { ...myParticipation, ...result } : null);
            }
            return success;
        }
    }, [myParticipation, selectedChallenge, marathonMutation, submitMutation, setMyParticipation]);

    // Initial Load Logic
    useEffect(() => {
        if (initialChallengeId && !initialProcessed.current) {
            initialProcessed.current = true;
            handleViewChallenge(initialChallengeId).then(() => {
                // Clear the URL parameter after successful load to keep the URL clean
                const url = new URL(window.location.href);
                if (url.searchParams.has('challenge')) {
                    url.searchParams.delete('challenge');
                    window.history.replaceState({}, '', url.pathname + url.search);
                }
            });
        }
    }, [initialChallengeId, handleViewChallenge]);

    // Context Value (Bridge)
    const contextValue: ChallengeContextType = useMemo(() => ({
        activeTab,
        setActiveTab,
        isPlaying,
        setIsPlaying,
        mode,
        setMode,
        length,
        setLength,
        maxTime,
        setMaxTime,
        selectedChallenge,
        setSelectedChallenge,
        myParticipation,
        participants,
        myChallenges,
        availableProfiles,
        invitedIds,
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        modeFilter,
        setModeFilter,
        lengthFilter,
        setLengthFilter,
        clearFilters,
        filteredChallenges,
        handleViewChallenge,
        handleCreate,
        handleStartGame,
        toggleInvite,
        copyLink: (c: Challenge) => {
            const url = `${window.location.origin}${window.location.pathname}?challenge=${c.id}`;
            const text = `Hey! I challenge you to a ${c.word_length === 1 ? 'Marathon' : c.word_length + '-letter Wordle'} match (${c.mode} mode)! 🏆\n\nJoin here: ${url}`;
            navigator.clipboard.writeText(text);
            triggerToast('Challenge link copied to clipboard!', 2000);
        },
        shareLink: async (c: Challenge) => {
            const url = `${window.location.origin}${window.location.pathname}?challenge=${c.id}`;
            const title = `Wordle Challenge`;
            const text = `Hey! I challenge you to a ${c.word_length === 1 ? 'Marathon' : c.word_length + '-letter Wordle'} match (${c.mode} mode)! 🏆`;
            if (navigator.share) {
                try {
                    await navigator.share({
                        title,
                        text,
                        url
                    });
                } catch (err: any) {
                    if (err.name !== 'AbortError') {
                        console.error('Error sharing:', err);
                        navigator.clipboard.writeText(`${text}\n\nJoin here: ${url}`);
                        triggerToast('Copied to clipboard instead!', 2000);
                    }
                }
            } else {
                navigator.clipboard.writeText(`${text}\n\nJoin here: ${url}`);
                triggerToast('Copied to clipboard!', 2000);
            }
        },
        loadMyChallenges: async () => { await refetchChallenges(); },
        submitResult,
        loading: isChallengesLoading || createMutation.isPending || submitMutation.isPending || joinMutation.isPending || startMutation.isPending || marathonMutation.isPending,
        error: null,
        joinId,
        setJoinId,
        previewParticipant,
        setPreviewParticipant,
        previewMarathonLength,
        setPreviewMarathonLength,
        unplayedCount,
        backAction,
        setBackAction,
        registerAnonymousUser,
        effectiveUser
    }), [activeTab, setActiveTab, isPlaying, setIsPlaying, mode, setMode, length, setLength, maxTime, setMaxTime, selectedChallenge, setSelectedChallenge, myParticipation, participants, myChallenges, availableProfiles, invitedIds, searchQuery, setSearchQuery, statusFilter, setStatusFilter, modeFilter, setModeFilter, lengthFilter, setLengthFilter, clearFilters, filteredChallenges, handleViewChallenge, handleCreate, handleStartGame, toggleInvite, triggerToast, refetchChallenges, submitResult, isChallengesLoading, createMutation.isPending, submitMutation.isPending, joinMutation.isPending, startMutation.isPending, marathonMutation.isPending, joinId, setJoinId, previewParticipant, setPreviewParticipant, previewMarathonLength, setPreviewMarathonLength, unplayedCount, backAction, setBackAction, registerAnonymousUser, effectiveUser]);

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
