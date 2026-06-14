/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAvailableProfiles, useChallengeMutations, useMyChallenges, mapChallenge, useDiscoverChallenges, useBulkChallengeParticipants, CHALLENGE_DETAILS_SELECT } from '../hooks/queries/useChallengeQueries';
import { useChallenge, type Challenge, type ChallengeParticipant } from '../hooks/useChallenge';
import { supabase } from '../lib/supabaseClient';
import { useChallengeStore } from '../store/useChallengeStore';
import { useApp } from './AppContext';
import { parseMarathonGames } from '../utils/marathon';
import { safeLocalStorage } from '../utils/storage';

interface ChallengeContextType {
    // ... rest of interface

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
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    statusFilter: 'ALL' | 'ACTIVE' | 'COMPLETED';
    setStatusFilter: (f: 'ALL' | 'ACTIVE' | 'COMPLETED') => void;
    modeFilter: 'ALL' | 'LIVE' | 'ANYTIME';
    setModeFilter: (m: 'ALL' | 'LIVE' | 'ANYTIME') => void;
    lengthFilter: 'ALL' | number;
    setLengthFilter: (l: 'ALL' | number) => void;
    listColumn: 'active' | 'played' | 'expired' | 'open';
    setListColumn: (col: 'active' | 'played' | 'expired' | 'open') => void;
    clearFilters: () => void;
    filteredChallenges: any[];

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
    unplayedCount: number;
    backAction: (() => void) | null;
    setBackAction: (fn: (() => void) | null) => void;
    effectiveUser: any;
    loadingParticipants: boolean;
    participantsError: string | null;
    retryFetchParticipants: () => void;
    openChallengesCount: number;
    dailyMarathonChallenge: any;
    initialChallengeId?: string | null | undefined;
}

const addRecentChallenge = (id: string) => {
    try {
        const stored = safeLocalStorage.getItem('wordle_recent_challenges');
        let ids: string[] = [];
        if (stored) {
            ids = JSON.parse(stored);
        }
        ids = ids.filter(i => i !== id);
        ids.unshift(id);
        if (ids.length > 20) {
            ids = ids.slice(0, 20);
        }
        safeLocalStorage.setItem('wordle_recent_challenges', JSON.stringify(ids));
    } catch (e) {
        console.error('Failed to add recent challenge', e);
    }
};

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
        const id = safeLocalStorage.getItem('wordle_anon_id');
        const username = safeLocalStorage.getItem('wordle_anon_username');
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
    const setInvitedIds = useChallengeStore(s => s.setInvitedIds);
    const toggleInvite = useChallengeStore(s => s.toggleInvite);
    const searchQuery = useChallengeStore(s => s.searchQuery);
    const setSearchQuery = useChallengeStore(s => s.setSearchQuery);
    const statusFilter = useChallengeStore(s => s.statusFilter);
    const setStatusFilter = useChallengeStore(s => s.setStatusFilter);
    const modeFilter = useChallengeStore(s => s.modeFilter);
    const setModeFilter = useChallengeStore(s => s.setModeFilter);
    const lengthFilter = useChallengeStore(s => s.lengthFilter);
    const setLengthFilter = useChallengeStore(s => s.setLengthFilter);
    const listColumn = useChallengeStore(s => s.listColumn);
    const setListColumn = useChallengeStore(s => s.setListColumn);
    const clearFilters = useChallengeStore(s => s.clearFilters);
    const resetForm = useChallengeStore(s => s.resetForm);
    const joinId = useChallengeStore(s => s.joinId);
    const setJoinId = useChallengeStore(s => s.setJoinId);
    const previewParticipant = useChallengeStore(s => s.previewParticipant);
    const setPreviewParticipant = useChallengeStore(s => s.setPreviewParticipant);
    const previewMarathonLength = useChallengeStore(s => s.previewMarathonLength);
    const setPreviewMarathonLength = useChallengeStore(s => s.setPreviewMarathonLength);
    const previewMarathonGameIndex = useChallengeStore(s => s.previewMarathonGameIndex);
    const setPreviewMarathonGameIndex = useChallengeStore(s => s.setPreviewMarathonGameIndex);
    const backAction = useChallengeStore(s => s.backAction);
    const setBackAction = useChallengeStore(s => s.setBackAction);

    const [isEditingChallenge, setIsEditingChallenge] = useState(false);

    // Date/Time utilities
    const getLagosDate = useCallback(() => {
        return new Intl.DateTimeFormat("en-CA", {
            timeZone: "Africa/Lagos",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).format(new Date());
    }, []);

    const playDate = useMemo(() => getLagosDate(), [getLagosDate]);

    // 1. Server Data (TanStack Query)
    const myChallengesQuery = useMyChallenges(effectiveUser?.id);
    const { data: myChallengesData, isLoading: isChallengesLoading, refetch: refetchChallenges, isFetching: isChallengesFetching, error: myChallengesError, failureCount: myChallengesFailureCount } = myChallengesQuery;
    
    const discoverChallengesQuery = useDiscoverChallenges();
    const { data: discoverChallengesData, isLoading: isDiscoverLoading, isFetching: isDiscoverFetching, error: discoverChallengesError, failureCount: discoverChallengesFailureCount } = discoverChallengesQuery;

    // Parallel fetch for all participants in the visible challenges list
    const challengeIds = useMemo(() => {
        const myIds = myChallengesData?.map((item: any) => item.challenge_id) || [];
        const discoverIds = discoverChallengesData?.map((c: any) => c.id) || [];
        return Array.from(new Set([...myIds, ...discoverIds]));
    }, [myChallengesData, discoverChallengesData]);

    const participantsBulkQuery = useBulkChallengeParticipants(challengeIds);
    const { data: participantsMap, isFetching: isParticipantsBulkFetching, failureCount: participantsBulkFailureCount } = participantsBulkQuery;

    const { data: profilesData } = useAvailableProfiles(effectiveUser?.id);
    const {
        createChallenge: createMutation,
        submitResult: submitMutation,
        joinChallenge: joinMutation,
        startChallenge: startMutation,
        submitMarathonResult: marathonMutation,
        updateChallenge: updateMutation,
        deleteChallenge: deleteMutation
    } = useChallengeMutations();

    // 2. Legacy Hook (Keep for real-time logic only)
    const challengeApi = useChallenge(user);
    const { subscribeToParticipants, participants, loadingParticipants, participantsError, retryFetchParticipants } = challengeApi;

    const isRetrying = myChallengesFailureCount > 0 || discoverChallengesFailureCount > 0 || participantsBulkFailureCount > 0;

    const isBackgroundFetching =
        ((isChallengesFetching && !isChallengesLoading) ||
        (listColumn === 'open' && isDiscoverFetching && !isDiscoverLoading) ||
        isParticipantsBulkFetching) && isRetrying;

    const error = (listColumn === 'open' ? discoverChallengesError : myChallengesError)
        ? ((listColumn === 'open' ? discoverChallengesError : myChallengesError) as any)?.message || "Failed to load challenges."
        : null;

    const channelRef = useRef<any>(null);
    const participantsCleanupRef = useRef<(() => void) | null>(null);
    const initialProcessed = useRef(false);

    // 3. Computed State (Merged with participants)
    const myChallenges = useMemo(() => {
        if (!myChallengesData) return [];
        if (!participantsMap) return myChallengesData;
        return myChallengesData.map((item: any) => ({
            ...item,
            challenge: {
                ...item.challenge,
                participants: participantsMap[item.challenge_id] || []
            }
        }));
    }, [myChallengesData, participantsMap]);

    const discoverChallenges = useMemo(() => {
        if (!discoverChallengesData) return [];
        if (!participantsMap) return discoverChallengesData;
        return discoverChallengesData.map((c: any) => ({
            ...c,
            participants: participantsMap[c.id] || []
        }));
    }, [discoverChallengesData, participantsMap]);

    const availableProfiles = useMemo(() => profilesData || [], [profilesData]);

    const myChallengesRef = useRef(myChallenges);
    const effectiveUserRef = useRef(effectiveUser);
    const userRef = useRef(user);

    useEffect(() => {
        myChallengesRef.current = myChallenges;
    }, [myChallenges]);

    useEffect(() => {
        effectiveUserRef.current = effectiveUser;
    }, [effectiveUser]);

    useEffect(() => {
        userRef.current = user;
    }, [user]);

    const openChallenges = useMemo(() => {
        if (!effectiveUser) return discoverChallenges;
        return discoverChallenges.filter((challenge: any) => {
            const isCreator = challenge.creator_id === effectiveUser.id;
            const isParticipant = challenge.participants?.some(
                (p: any) => p.user_id === effectiveUser.id || p.guest_id === effectiveUser.id
            );
            return !isCreator && !isParticipant;
        });
    }, [discoverChallenges, effectiveUser]);

    const openChallengeItems = useMemo(() => {
        return openChallenges.map((c: any) => ({
            id: `open-${c.id}`,
            challenge_id: c.id,
            challenge: c,
            status: 'open',
            score: 0,
            attempts: 0,
            guesses: []
        }));
    }, [openChallenges]);

    const dailyMarathonChallenge = useMemo(() => {
        // Find in openChallenges
        const openDaily = discoverChallenges.find((c: any) => c.is_bot_marathon);

        if (openDaily) {
            return {
                id: `open-${openDaily.id}`,
                challenge_id: openDaily.id,
                challenge: openDaily,
                status: 'open',
                score: 0,
                attempts: 0,
                guesses: []
            };
        }
        // Find in myChallenges (pending status)
        const pendingDaily = myChallenges.find((item: any) => item.challenge?.is_bot_marathon && item.status === 'pending');
        if (pendingDaily) return pendingDaily;

        return null;
    }, [discoverChallenges, myChallenges]);

    const unplayedCount = useMemo(() =>
        myChallenges.filter((c: any) => {
            const isBotMarathon = c.challenge?.is_bot_marathon;
            if (isBotMarathon && c.status === 'pending') return false;
            return (c.status === 'pending' || c.status === 'playing') && new Date(c.challenge.expires_at) > new Date();
        }).length,
        [myChallenges]
    );

    useEffect(() => {
        setChallengeUnreadCount(unplayedCount);
    }, [unplayedCount, setChallengeUnreadCount]);

    const filteredChallenges = useMemo(() => {
        let sourceList: any[] = [];
        if (listColumn === 'active') {
            sourceList = myChallenges.filter((item: any) => {
                const isExpired = new Date(item.challenge?.expires_at) < new Date();
                const isCompleted = item.status === 'completed' || item.status === 'timed_out' || item.status === 'declined';
                const isBotMarathon = item.challenge?.is_bot_marathon;
                if (isBotMarathon && item.status === 'pending') return false;
                return !isExpired && !isCompleted && item.status !== 'viewed';
            });
        } else if (listColumn === 'played') {
            sourceList = myChallenges.filter((item: any) => {
                const isExpired = new Date(item.challenge?.expires_at) < new Date();
                const isCompleted = item.status === 'completed' || item.status === 'timed_out' || item.status === 'declined';
                return !isExpired && isCompleted && item.status !== 'viewed';
            });
        } else if (listColumn === 'expired') {
            sourceList = myChallenges.filter((item: any) => {
                const isExpired = new Date(item.challenge?.expires_at) < new Date();
                return isExpired;
            });
        } else if (listColumn === 'open') {
            sourceList = openChallengeItems;
        }

        return sourceList.filter((item: any) => {
            const challenge = item.challenge;
            if (!challenge) return false;

            if (modeFilter !== 'ALL' && challenge.mode !== modeFilter) return false;
            if (lengthFilter !== 'ALL' && challenge.word_length !== lengthFilter) return false;

            if (searchQuery) {
                const query = searchQuery.toLowerCase();
                const creatorName = challenge.creator?.username?.toLowerCase() || '';
                const opponentNames = challenge.participants
                    ?.filter((p: any) => p.user_id !== effectiveUser?.id && p.guest_id !== effectiveUser?.id)
                    .map((p: any) => p.profiles?.username?.toLowerCase() || '')
                    .join(' ') || '';

                if (!creatorName.includes(query) && !opponentNames.includes(query)) return false;
            }
            return true;
        });
    }, [myChallenges, openChallengeItems, listColumn, modeFilter, lengthFilter, searchQuery, effectiveUser?.id]);

        // 4. Action Wrappers
    const cleanupSubscription = useCallback(() => {
        // Call the participants cleanup function if it exists
        if (participantsCleanupRef.current) {
            participantsCleanupRef.current();
            participantsCleanupRef.current = null;
        }
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
    }, []);

    useEffect(() => cleanupSubscription, [cleanupSubscription]);

    // Real-time user challenges list sync
    useEffect(() => {
        const userId = effectiveUser?.id;
        if (!userId) return;

        // Optimize performance by filtering at the database level.
        // Since we want to match user_id or guest_id, we register two separate postgres_changes filters on the same channel.
        const channel = supabase
            .channel(`user_challenges_realtime_${userId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'challenge_participants',
                    filter: `user_id=eq.${userId}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['my-challenges', userId] });
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'challenge_participants',
                    filter: `guest_id=eq.${userId}`,
                },
                () => {
                    queryClient.invalidateQueries({ queryKey: ['my-challenges', userId] });
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [effectiveUser?.id, queryClient]);

    const normalizeParticipation = useCallback((p: any, challenge: any) => {
        if (!p || !challenge) return p;
        if (p.status === 'host') return p;
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

    const handleViewChallenge = useCallback(async (id: string | null | undefined) => {
        if (!id || id === "null" || id === "undefined") {
            return;
        }

        // 1. Check local cache (myChallenges) for immediate display
        const localMatch = myChallengesRef.current.find((item: any) => item.challenge_id === id || item.challenge?.id === id);

        if (localMatch && localMatch.challenge) {
            const cachedChallenge = { ...localMatch.challenge };
            cachedChallenge.participants = cachedChallenge.participants?.map((p: any) => normalizeParticipation(p, cachedChallenge)) || [];

            setSelectedChallenge(cachedChallenge);
            setMyParticipation(normalizeParticipation(localMatch, cachedChallenge));
            setActiveTab('join');
        } else {
            const currentSelected = useChallengeStore.getState().selectedChallenge;
            if (currentSelected?.id !== id) {
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
                        .select(CHALLENGE_DETAILS_SELECT)
                        .eq('id', id)
                        .maybeSingle();

                    if (error) throw error;
                    if (data) {
                        const c = mapChallenge(data) as any;
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
                const isExpired = new Date(challenge.expires_at) < new Date();
                if (isExpired) {
                    triggerToast("This challenge has expired. Viewing results.", 4000);
                }

                // Add to recent challenges in localStorage
                addRecentChallenge(challenge.id);
                queryClient.invalidateQueries({ queryKey: ['my-challenges'] });

                cleanupSubscription();
                setSelectedChallenge(challenge);
                setActiveTab('join');

                const currentUser = effectiveUserRef.current;
                // If user is authenticated or has guest ID, load/join participation
                if (currentUser) {
                    const isCreatorOfCustom = challenge.creator_id === currentUser.id && challenge.is_custom_word;
                    if (!isCreatorOfCustom) {
                        const participationPromise = !isExpired
                            ? joinMutation.mutateAsync({ challengeId: challenge.id, userId: currentUser.id, isGuest: !userRef.current })
                            : Promise.resolve(localMatch || null);

                        let participation = localMatch;
                        if (!participation && !isExpired) {
                            participation = await participationPromise;
                        } else if (isExpired) {
                            participation = challenge.participants?.find((p: any) => p.user_id === currentUser.id || p.guest_id === currentUser.id) || null;
                        }

                        const normalizedPart = normalizeParticipation(participation, challenge);
                        setMyParticipation(normalizedPart);
                    } else {
                        setMyParticipation(null);
                    }
                } else {
                    setMyParticipation(null);
                }

                // subscribeToParticipants now returns a cleanup function
                const cleanup = subscribeToParticipants(challenge.id);
                participantsCleanupRef.current = cleanup;
                // Keep channelRef for backward compatibility (used elsewhere)
                const existingChannels = supabase.getChannels().filter(
                    (c) => (c as any).topic === `realtime:challenge_participants_${challenge.id}` ||
                            (c as any).topic === `realtime:challenge_participants_marathon_${challenge.id}`
                );
                channelRef.current = existingChannels[0] || null;
            } else {
                triggerToast("Invalid challenge link or code.", 4000);
            }
        } catch (err: any) {
            console.error("Failed to load challenge details", err);
            triggerToast(err?.message || "Failed to load challenge details.", 4000);
        }
    }, [normalizeParticipation, setSelectedChallenge, setMyParticipation, setActiveTab, queryClient, cleanupSubscription, joinMutation, subscribeToParticipants, triggerToast]);

    const joinSelectedChallenge = useCallback(async () => {
        if (!selectedChallenge || !effectiveUser) return;
        const isExpired = new Date(selectedChallenge.expires_at) < new Date();
        if (isExpired) return;
        try {
            const isCreatorOfCustom = selectedChallenge.creator_id === effectiveUser.id && selectedChallenge.is_custom_word;
            if (isCreatorOfCustom) {
                setMyParticipation(null);
                return;
            }

            const participation = await joinMutation.mutateAsync({
                challengeId: selectedChallenge.id,
                userId: effectiveUser.id,
                isGuest: !user
            });
            const normalizedPart = normalizeParticipation(participation, selectedChallenge);
            setMyParticipation(normalizedPart);
        } catch (err: any) {
            console.error("Failed to join challenge:", err);
            triggerToast(err?.message || "Failed to join challenge.", 4000);
        }
    }, [selectedChallenge, effectiveUser, joinMutation, normalizeParticipation, triggerToast, setMyParticipation, user]);

    const registerAnonymousUser = useCallback(async (nickname: string) => {
        let anonId = safeLocalStorage.getItem('wordle_anon_id');
        if (!anonId) {
            anonId = crypto.randomUUID();
            safeLocalStorage.setItem('wordle_anon_id', anonId);
        }
        safeLocalStorage.setItem('wordle_anon_username', nickname);

        // Insert/update guest profile in database
        const { error } = await supabase.from('guest_profiles').upsert({
            id: anonId,
            username: nickname,
            avatar_url: `https://api.dicebear.com/7.x/bottts/svg?seed=${anonId}`
        });

        if (error) {
            console.error("Error creating guest profile:", error);
            triggerToast("Failed to create guest profile. Please try again.", 4000);
            return null;
        }

        const newUser = { id: anonId, username: nickname, user_metadata: { full_name: nickname } };
        setAnonUser(newUser);
        return newUser;
    }, [triggerToast]);

    // Auto-join when selectedChallenge is active and effectiveUser becomes available
    useEffect(() => {
        if (selectedChallenge && effectiveUser && !myParticipation && !joinMutation.isPending && !loadingParticipants) {
            const isCreatorOfCustom = selectedChallenge.creator_id === effectiveUser.id && selectedChallenge.is_custom_word;
            const isExpired = new Date(selectedChallenge.expires_at) < new Date();
            if (!isCreatorOfCustom) {
                // Use the participants array from context (which is synced via subscribeToParticipants)
                const alreadyParticipant = participants.find((p: any) => p.user_id === effectiveUser.id || p.guest_id === effectiveUser.id);
                if (alreadyParticipant) {
                    setMyParticipation(normalizeParticipation(alreadyParticipant, selectedChallenge));
                } else if (!isExpired) {
                    joinSelectedChallenge();
                }
            }
        }
    }, [selectedChallenge, effectiveUser, myParticipation, joinSelectedChallenge, normalizeParticipation, joinMutation.isPending, setMyParticipation, participants, loadingParticipants]);

    // Reset challenge state on unmount (when closing ChallengeModal)
    useEffect(() => {
        return () => {
            setSelectedChallenge(null);
            setMyParticipation(null);
            setIsPlaying(false);
            setPreviewParticipant(null);
            setPreviewMarathonLength(null);
            setPreviewMarathonGameIndex(null);
        };
    }, [setSelectedChallenge, setMyParticipation, setIsPlaying, setPreviewParticipant, setPreviewMarathonLength, setPreviewMarathonGameIndex]);

    const handleCreate = useCallback(async (customParams?: any, viewAfterCreate = true) => {
        if (!effectiveUser) return;
        try {
            const isBotMarathon = !!customParams?.is_bot_marathon || !!customParams?.isBotMarathon;
            const creatorId = isBotMarathon ? '00000000-0000-0000-0000-000000000b0b' : effectiveUser.id;

            const challenge = await createMutation.mutateAsync({
                creatorId: creatorId,
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

                if (viewAfterCreate) {
                    handleViewChallenge(challenge.id);
                } else {
                    await refetchChallenges();
                }
            }
        } catch (err: any) {
            console.error("Failed to create challenge:", err);
            triggerToast(err?.message || "Failed to create challenge.", 4000);
        }
    }, [mode, length, maxTime, invitedIds, effectiveUser, createMutation, availableProfiles, onChallengeCreated, resetForm, handleViewChallenge, triggerToast, refetchChallenges]);

    const handleEdit = useCallback(async (challengeId: string, params: any) => {
        try {
            await updateMutation.mutateAsync({ challengeId, params });
            triggerToast("Challenge updated successfully!", 3000);
            setIsEditingChallenge(false);
        } catch (err: any) {
            console.error("Failed to update challenge:", err);
            triggerToast(err?.message || "Failed to update challenge.", 4000);
            throw err;
        }
    }, [updateMutation, triggerToast]);

    const handleDelete = useCallback(async (challengeId: string) => {
        try {
            await deleteMutation.mutateAsync(challengeId);
            setSelectedChallenge(null);
            triggerToast("Challenge deleted successfully.", 3000);
        } catch (err: any) {
            console.error("Failed to delete challenge:", err);
            triggerToast(err?.message || "Failed to delete challenge.", 4000);
            throw err;
        }
    }, [deleteMutation, setSelectedChallenge, triggerToast]);

    const handleStartGame = useCallback(async () => {
        if (!selectedChallenge || !myParticipation) return;

        try {
            if (myParticipation.status === 'pending') {
                await startMutation.mutateAsync(myParticipation.id);
            }
            setIsPlaying(true);
        } catch (err: any) {
            console.error("Failed to start challenge game:", err);
            triggerToast(err?.message || "Failed to start challenge.", 4000);
        }
    }, [selectedChallenge, myParticipation, startMutation, setIsPlaying, triggerToast]);

    const submitResult = useCallback(async (result: any, wordLength?: number, gameIndex?: number) => {
        if (!myParticipation) return false;

        const isMarathon = selectedChallenge?.word_length === 1;
        const isBotMarathon = selectedChallenge?.is_bot_marathon;

        try {
            if (isMarathon && (wordLength || gameIndex !== undefined)) {
                const isWordFinished = result.status !== 'playing';
                const games = parseMarathonGames(selectedChallenge?.target_word, selectedChallenge?.salt);
                const resolvedGameIndex = gameIndex !== undefined ? gameIndex : (wordLength ? games.findIndex(g => g.wordLength === wordLength) : 0);

                // 1. Always update the specific word progress
                const marathonPromise = marathonMutation.mutateAsync({
                    participationId: myParticipation.id,
                    challengeId: selectedChallenge!.id,
                    gameIndex: resolvedGameIndex,
                    wordLength: wordLength || games[resolvedGameIndex]?.wordLength || 5,
                    result,
                    playDate: isBotMarathon ? playDate : undefined
                });

                // If not finishing the word, we can just wait for the marathon update
                if (!isWordFinished) {
                    const success = await marathonPromise;
                    if (!success) return false;

                    // Update local state for immediate UI feedback without full re-fetch
                    const currentMarathon = myParticipation.marathon_progress || [];
                    const updatedMarathon = [...currentMarathon];
                    const idx = updatedMarathon.findIndex(p => p.game_index === resolvedGameIndex || (p.game_index === undefined && p.word_length === wordLength));
                    if (idx > -1) updatedMarathon[idx] = { ...updatedMarathon[idx], game_index: resolvedGameIndex, ...result };
                    else updatedMarathon.push({ game_index: resolvedGameIndex, word_length: wordLength || 5, ...result } as any);

                    setMyParticipation({ ...myParticipation, marathon_progress: updatedMarathon });
                    return true;
                }

                // 2. Word finished: Calculate aggregates and update main participation
                const currentMarathon = myParticipation.marathon_progress || [];
                const updatedMarathon = [...currentMarathon];
                const idx = updatedMarathon.findIndex(p => p.game_index === resolvedGameIndex || (p.game_index === undefined && p.word_length === wordLength));

                if (idx > -1) {
                    updatedMarathon[idx] = { ...updatedMarathon[idx], game_index: resolvedGameIndex, ...result };
                } else {
                    updatedMarathon.push({ game_index: resolvedGameIndex, word_length: wordLength || 5, ...result } as any);
                }

                let totalScore = 0;
                let totalAttempts = 0;
                let totalTimeTaken = 0;
                let completedCount = 0;

                games.forEach(g => {
                    const prog = updatedMarathon.find(p => p.game_index === g.gameIndex || (p.game_index === undefined && p.word_length === g.wordLength));
                    if (prog) {
                        totalAttempts += prog.attempts || 0;
                        totalTimeTaken += prog.time_taken || 0;
                        if (prog.status === 'completed' || prog.status === 'timed_out') {
                            totalScore += prog.score || 0;
                            completedCount++;
                        }
                    }
                });

                const allCompleted = completedCount === games.length;
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
        } catch (err: any) {
            console.error("Failed to submit challenge result:", err);
            return false;
        }
    }, [myParticipation, selectedChallenge, marathonMutation, submitMutation, setMyParticipation]);

    // Initial Load Logic
    useEffect(() => {
        if (initialProcessed.current) return;
        initialProcessed.current = true;

        if (initialChallengeId && initialChallengeId !== "null" && initialChallengeId !== "undefined") {
            handleViewChallenge(initialChallengeId).then(() => {
                // Clear the URL parameter after successful load to keep the URL clean
                const url = new URL(window.location.href);
                if (url.searchParams.has('challenge')) {
                    url.searchParams.delete('challenge');
                    window.history.replaceState({}, '', url.pathname + url.search);
                }
            });
        } else {
            setSelectedChallenge(null);
            setMyParticipation(null);
        }
    }, [initialChallengeId, handleViewChallenge, setSelectedChallenge, setMyParticipation]);

    const hasSetDefaultTab = useRef(false);

    // Dynamic Default View Priority Auto-Selection on Open
    useEffect(() => {
        if (isChallengesLoading || hasSetDefaultTab.current) return;
        if (myChallengesData) {
            hasSetDefaultTab.current = true;

            const activeChallenges = myChallengesData.filter((item: any) => {
                const isExpired = new Date(item.challenge?.expires_at) < new Date();
                const isCompleted = item.status === 'completed' || item.status === 'timed_out' || item.status === 'declined';
                return !isExpired && !isCompleted && item.status !== 'viewed';
            });

            const playedChallenges = myChallengesData.filter((item: any) => {
                const isExpired = new Date(item.challenge?.expires_at) < new Date();
                const isCompleted = item.status === 'completed' || item.status === 'timed_out' || item.status === 'declined';
                return !isExpired && isCompleted && item.status !== 'viewed';
            });

            const expiredChallenges = myChallengesData.filter((item: any) => {
                return new Date(item.challenge?.expires_at) < new Date();
            });

            if (activeChallenges.length > 0) {
                setListColumn('active');
            } else if (playedChallenges.length > 0) {
                setListColumn('played');
            } else if (expiredChallenges.length > 0) {
                setListColumn('expired');
            } else {
                setListColumn('active');
            }
        }
    }, [isChallengesLoading, myChallengesData, setListColumn]);

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
        setMyParticipation,
        participants,
        myChallenges,
        availableProfiles,
        invitedIds,
        setInvitedIds,
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
        handleEdit,
        handleDelete,
        handleStartGame,
        toggleInvite,
        copyLink: (c: Challenge) => {
            const url = `${window.location.origin}${window.location.pathname}?challenge=${c.id}`;
            const text = `Hey! I challenge you to a ${c.word_length === 1 ? 'Marathon' : c.word_length + '-letter'} match (${c.mode} mode)! 🏆\n\nJoin here: ${url}`;
            navigator.clipboard.writeText(text);
            triggerToast('Challenge link copied to clipboard!', 2000);
        },
        shareLink: async (c: Challenge) => {
            const url = `${window.location.origin}${window.location.pathname}?challenge=${c.id}`;
            const title = `Variant Challenge`;
            const text = `Hey! I challenge you to a ${c.word_length === 1 ? 'Marathon' : c.word_length + '-letter'} match (${c.mode} mode)! 🏆`;
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
        listColumn,
        setListColumn,
        loading: isChallengesLoading || (listColumn === 'open' && isDiscoverLoading) || createMutation.isPending || submitMutation.isPending || joinMutation.isPending || startMutation.isPending || marathonMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
        isBackgroundFetching,
        error,
        joinId,
        setJoinId,
        previewParticipant,
        setPreviewParticipant,
        previewMarathonLength,
        setPreviewMarathonLength,
        previewMarathonGameIndex,
        setPreviewMarathonGameIndex,
        unplayedCount,
        backAction,
        setBackAction,
        registerAnonymousUser,
        effectiveUser,
        isEditingChallenge,
        setIsEditingChallenge,
        loadingParticipants,
        participantsError,
        retryFetchParticipants,
        openChallengesCount: openChallenges.length,
        dailyMarathonChallenge,
        initialChallengeId,
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), [activeTab, setActiveTab, isPlaying, setIsPlaying, mode, setMode, length, setLength, maxTime, setMaxTime, selectedChallenge, setSelectedChallenge, myParticipation, setMyParticipation, participants, myChallenges, availableProfiles, invitedIds, setInvitedIds, searchQuery, setSearchQuery, statusFilter, setStatusFilter, modeFilter, setModeFilter, lengthFilter, setLengthFilter, clearFilters, filteredChallenges, handleViewChallenge, handleCreate, handleEdit, handleDelete, handleStartGame, toggleInvite, triggerToast, refetchChallenges, submitResult, isChallengesLoading, isDiscoverLoading, createMutation.isPending, submitMutation.isPending, joinMutation.isPending, startMutation.isPending, marathonMutation.isPending, updateMutation.isPending, deleteMutation.isPending, joinId, setJoinId, previewParticipant, setPreviewParticipant, previewMarathonLength, setPreviewMarathonLength, previewMarathonGameIndex, setPreviewMarathonGameIndex, unplayedCount, backAction, setBackAction, registerAnonymousUser, effectiveUser, isEditingChallenge, setIsEditingChallenge, listColumn, setListColumn, loadingParticipants, participantsError, retryFetchParticipants, isBackgroundFetching, openChallenges, dailyMarathonChallenge, initialChallengeId]);

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
