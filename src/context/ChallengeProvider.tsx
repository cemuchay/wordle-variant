/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAvailableProfiles, useChallengeMutations, useMyChallenges, useDiscoverChallenges, useBulkChallengeParticipants, CHALLENGE_DETAILS_SELECT } from '../hooks/queries/useChallengeQueries';
import { useChallenge, type Challenge, type ChallengeParticipant } from '../hooks/useChallenge';
import { supabase } from '../lib/supabaseClient';
import { useChallengeStore } from '../store/useChallengeStore';
import { useApp } from './AppContext';
import { parseMarathonGames } from '../utils/marathon';
import { safeLocalStorage } from '../utils/storage';
import { saveChallengeView, loadChallengeView } from '../utils/challengeViewPersistence';
import { useAppStore } from '../store/useAppStore';
import { ChallengeFiltersProvider } from './ChallengeFiltersContext';
import { ChallengeContext, type ChallengeContextType } from './ChallengeContext';

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

    const registerAnonymousUser = async (nickname: string) => {
        const guestId = `guest_${Math.random().toString(36).substring(2, 15)}`;
        safeLocalStorage.setItem('wordle_anon_id', guestId);
        safeLocalStorage.setItem('wordle_anon_username', nickname);
        
        // Push a basic guest profile placeholder to database
        const { error } = await supabase
            .from('guest_profiles')
            .insert([{ id: guestId, username: nickname }]);

        if (error) {
            triggerToast('Failed to register guest name. Try a different name.', 4000);
            return null;
        }

        const newUser = { id: guestId, username: nickname, user_metadata: { full_name: nickname } };
        setAnonUser(newUser);
        return newUser;
    };

    // Derived User Reference
    const effectiveUser = user || anonUser;
    const effectiveUserRef = useRef(effectiveUser);
    useEffect(() => {
        effectiveUserRef.current = effectiveUser;
    }, [effectiveUser]);

    const userRef = useRef(user);
    useEffect(() => {
        userRef.current = user;
    }, [user]);

    // UI Tab State (Default to 'my')
    const activeTab = useChallengeStore(s => s.activeTab);
    const setActiveTab = useChallengeStore(s => s.setActiveTab);
    const isPlaying = useChallengeStore(s => s.isPlaying);
    const setIsPlaying = useChallengeStore(s => s.setIsPlaying);
    const isEditingChallenge = useChallengeStore(s => s.isEditingChallenge);
    const setIsEditingChallenge = useChallengeStore(s => s.setIsEditingChallenge);

    // Filter Column State ('unplayed' vs 'played')
    const listColumn = useChallengeStore(s => s.listColumn);
    const setListColumn = useChallengeStore(s => s.setListColumn);

    // Form Config State
    const mode = useChallengeStore(s => s.mode);
    const setMode = useChallengeStore(s => s.setMode);
    const length = useChallengeStore(s => s.length);
    const setLength = useChallengeStore(s => s.setLength);
    const maxAttempts = useChallengeStore(s => s.maxAttempts);
    const setMaxAttempts = useChallengeStore(s => s.setMaxAttempts);
    const maxTime = useChallengeStore(s => s.maxTime);
    const setMaxTime = useChallengeStore(s => s.setMaxTime);

    // Selected Challenge Data state
    const selectedChallenge = useChallengeStore(s => s.selectedChallenge);
    const setSelectedChallenge = useChallengeStore(s => s.setSelectedChallenge);
    const myParticipation = useChallengeStore(s => s.myParticipation);
    const setMyParticipation = useChallengeStore(s => s.setMyParticipation);
    const invitedIds = useChallengeStore(s => s.invitedIds);
    const setInvitedIds = useChallengeStore(s => s.setInvitedIds);

    // Anonymous User Overlay controls
    const joinId = useChallengeStore(s => s.joinId);
    const setJoinId = useChallengeStore(s => s.setJoinId);

    // Preview / History Modal configuration state
    const previewParticipant = useChallengeStore(s => s.previewParticipant);
    const setPreviewParticipant = useChallengeStore(s => s.setPreviewParticipant);
    const previewMarathonLength = useChallengeStore(s => s.previewMarathonLength);
    const setPreviewMarathonLength = useChallengeStore(s => s.setPreviewMarathonLength);
    const previewMarathonGameIndex = useChallengeStore(s => s.previewMarathonGameIndex);
    const setPreviewMarathonGameIndex = useChallengeStore(s => s.setPreviewMarathonGameIndex);
    const backAction = useChallengeStore(s => s.backAction);
    const setBackAction = useChallengeStore(s => s.setBackAction);

    const activeGameLength = useChallengeStore(s => s.activeGameLength);

    const [bootstrappingMessage, setBootstrappingMessage] = useState<string | null>(null);

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
            (listColumn === 'unplayed' && isDiscoverFetching && !isDiscoverLoading) ||
            isParticipantsBulkFetching) && isRetrying;

    const error = (listColumn === 'unplayed' ? (discoverChallengesError || myChallengesError) : myChallengesError)
        ? 'Network issue. Trying to reconnect...'
        : null;

    const myChallenges = useMemo(() => {
        if (!myChallengesData) return [];
        
        // Map bulk participants count and details into my-challenges array
        return myChallengesData.map((item: any) => {
            const resolvedParticipants = participantsMap?.[item.challenge_id] || item.challenge?.participants || [];
            return {
                ...item,
                challenge: {
                    ...item.challenge,
                    participants: resolvedParticipants
                }
            };
        });
    }, [myChallengesData, participantsMap]);

    // Discoverable Public Challenges (Filter out creator/already-joined ones)
    const dailyMarathonChallenges = useMemo(() => {
        if (!discoverChallengesData) return [];
        const joinedSet = new Set(myChallenges.map(c => c.challenge_id));

        return discoverChallengesData
            .filter((c: any) => {
                if (joinedSet.has(c.id)) return false;
                if (c.creator_id === effectiveUser?.id) return false;
                return true;
            })
            .map((c: any) => {
                const resolvedParticipants = participantsMap?.[c.id] || c.participants || [];
                return {
                    ...c,
                    participants: resolvedParticipants
                };
            });
    }, [discoverChallengesData, myChallenges, effectiveUser?.id, participantsMap]);

    const availableProfiles = useMemo(() => {
        return profilesData || [];
    }, [profilesData]);

    const myChallengesRef = useRef(myChallenges);
    useEffect(() => {
        myChallengesRef.current = myChallenges;
    }, [myChallenges]);

    const normalizeParticipation = useCallback((participation: any, challenge: any) => {
        if (!participation && challenge) {
            return {
                id: `viewed-${challenge.id}`,
                challenge_id: challenge.id,
                user_id: effectiveUserRef.current?.id || null,
                status: 'viewed' as const,
                score: 0,
                attempts: 0,
                guesses: [],
                challenge
            };
        }
        return participation;
    }, []);

    // 3. Subscription & View Handling
    const handleViewChallenge = useCallback(async (id: string) => {
        let isExpired = false;
        try {
            const { data: rawChallenge, error: chalError } = await supabase
                .from('challenges')
                .select(`
                    *,
                    participants:challenge_participants(
                        id, challenge_id, user_id, guest_id, status, score, attempts, hints_used, time_taken, started_at, completed_at, target_words,
                        profiles(username, avatar_url),
                        guest_profiles(username, avatar_url),
                        marathon_progress:challenge_participants_marathon(
                            id, participation_id, game_index, word_length, status, score, attempts, hints_used, time_taken, started_at, completed_at, target_words
                        )
                    )
                `)
                .eq('id', id)
                .single();

            if (chalError || !rawChallenge) {
                triggerToast('Challenge not found or deleted.', 4000);
                return;
            }

            const challenge = mapChallenge(rawChallenge);
            isExpired = new Date(challenge.expires_at) < new Date();

            if (challenge) {
                // Subscribe to real-time participant events
                subscribeToParticipants(challenge.id);

                // Try to find local match or database match
                const currentUser = effectiveUserRef.current;
                const localMatch = myChallengesRef.current.find(
                    (item: any) => item.challenge_id === challenge.id || item.challenge?.id === challenge.id
                ) || null;

                if (isExpired && !localMatch) {
                    triggerToast("This challenge has expired. Viewing results.", 4000);
                }

                // Add to recent challenges in localStorage
                addRecentChallenge(challenge.id);
                queryClient.invalidateQueries({ queryKey: ['my-challenges'] });

                cleanupSubscription();
                setSelectedChallenge(challenge);
                setActiveTab('join');

                // Initialize form state with challenge data
                if (challenge.mode) setMode(challenge.mode as any);
                if (challenge.word_length) setLength(challenge.word_length);
                if (challenge.max_attempts) setMaxAttempts(challenge.max_attempts);
                if (challenge.max_time) setMaxTime(challenge.max_time);

                const currentUser2 = effectiveUserRef.current;
                // If user is authenticated or has guest ID, load/join participation
                if (currentUser2) {
                    const isCreatorOfCustom = challenge.creator_id === currentUser2.id && challenge.is_custom_word;
                    if (!isCreatorOfCustom) {
                        const participationPromise = !isExpired
                            ? joinMutation.mutateAsync({ challengeId: challenge.id, userId: currentUser2.id, isGuest: !userRef.current })
                            : Promise.resolve(localMatch || null);

                        const dbMatch = challenge.participants?.find((p: any) => p.user_id === currentUser2.id || p.guest_id === currentUser2.id) || null;
                        let participation = localMatch;

                        if (dbMatch && dbMatch.status !== "viewed" && dbMatch.status !== "pending") {
                            participation = dbMatch;
                        } else {
                            if (!participation && !isExpired) {
                                participation = await participationPromise;
                            } else if (isExpired) {
                                participation = dbMatch;
                            }
                        }

                        // Override with fresh data from refetched my-challenges if available (ignoring synthetic viewed records)
                        const freshData = queryClient.getQueryData(['my-challenges', currentUser2.id]) as any[];
                        if (freshData) {
                            const freshMatch = freshData.find(
                                (item: any) => item.challenge_id === id || item.challenge?.id === id
                            );
                            if (freshMatch && freshMatch.status !== "viewed" && freshMatch.marathon_progress?.length >= (participation?.marathon_progress?.length || 0)) {
                                participation = freshMatch;
                            }
                            myChallengesRef.current = freshData;
                        }

                        const normalizedPart = normalizeParticipation(participation, challenge);
                        setMyParticipation(normalizedPart);

                        // If user is playing, set visual state instantly
                        if (normalizedPart?.status === 'playing') {
                            setIsPlaying(true);
                        } else {
                            setIsPlaying(false);
                        }
                    } else {
                        // Creator of custom word: cannot play, just viewing lobby
                        setMyParticipation(null);
                        setIsPlaying(false);
                    }
                } else {
                    // Anonymous/Guest not registered yet: default to viewed representation
                    const normalizedPart = normalizeParticipation(null, challenge);
                    setMyParticipation(normalizedPart);
                    setIsPlaying(false);
                }
            }
        } catch (e) {
            console.error('Failed to view challenge:', e);
            triggerToast('Failed to load challenge details.', 4000);
        }
    }, [subscribeToParticipants, queryClient, joinMutation, normalizeParticipation, triggerToast, setSelectedChallenge, setMyParticipation, setIsPlaying, setActiveTab, setMode, setLength, setMaxAttempts, setMaxTime]);

    // Handle Deep Linking / Query Parameters bootstrap on mount
    useEffect(() => {
        let active = true;
        
        const bootstrapUrlChallenge = async () => {
            if (!initialChallengeId) return;

            setBootstrappingMessage("Connecting to challenge...");
            
            // Wait slightly for auth states to settle down
            await new Promise((resolve) => setTimeout(resolve, 800));
            if (!active) return;

            await handleViewChallenge(initialChallengeId);
            
            if (active) {
                setBootstrappingMessage(null);
            }
        };

        bootstrapUrlChallenge();

        return () => {
            active = false;
        };
    }, [initialChallengeId, handleViewChallenge]);

    const joinSelectedChallenge = useCallback(async () => {
        const currentUser = effectiveUserRef.current;
        if (selectedChallenge && currentUser) {
            const participation = await joinMutation.mutateAsync({
                challengeId: selectedChallenge.id,
                userId: currentUser.id,
                isGuest: !userRef.current
            });
            const normalizedPart = normalizeParticipation(participation, selectedChallenge);
            setMyParticipation(normalizedPart);
            if (normalizedPart?.status === 'playing') {
                setIsPlaying(true);
            }
        }
    }, [selectedChallenge, joinMutation, normalizeParticipation, setMyParticipation, setIsPlaying]);

    // Auto-join viewed challenges once user registers guest nickname
    useEffect(() => {
        const autoJoin = async () => {
            const currentUser = effectiveUserRef.current;
            if (selectedChallenge && currentUser && !myParticipation && !joinMutation.isPending && !loadingParticipants) {
                // Double check if already in the local participant list to avoid duplicate mutation requests
                const alreadyRegistered = participants.some((p) => p.user_id === currentUser.id || p.guest_id === currentUser.id);
                if (!alreadyRegistered) {
                    await joinSelectedChallenge();
                }
            }
        };
        autoJoin();
    }, [selectedChallenge, effectiveUser, myParticipation, joinSelectedChallenge, normalizeParticipation, joinMutation.isPending, setMyParticipation, participants, loadingParticipants]);

    const handleCreate = async (customParams?: any, viewAfterCreate = true) => {
        const currentUser = effectiveUserRef.current;
        if (!currentUser) {
            triggerToast('You must set a name to create a challenge.', 4000);
            return;
        }

        const isLiveMode = (customParams?.mode || mode) === 'LIVE';

        // Set default expiration based on mode: 2 hours for LIVE, 24 hours for ANYTIME
        const defaultExpirationHours = isLiveMode ? 2 : 24;
        const computedExpiresAt = new Date(Date.now() + defaultExpirationHours * 60 * 60 * 1000).toISOString();

        const params = {
            creator_id: userRef.current ? currentUser.id : null,
            guest_creator_id: !userRef.current ? currentUser.id : null,
            mode: customParams?.mode || mode,
            word_length: customParams?.word_length || length,
            max_attempts: customParams?.max_attempts || maxAttempts,
            max_time: customParams?.max_time || maxTime,
            expires_at: customParams?.expires_at || computedExpiresAt,
            target_word: customParams?.target_word || null,
            salt: customParams?.salt || null,
            is_custom_word: !!customParams?.target_word,
            is_public: customParams?.is_public !== undefined ? customParams.is_public : true,
            disable_hints: customParams?.disable_hints !== undefined ? customParams.disable_hints : false,
            is_bot_marathon: customParams?.is_bot_marathon !== undefined ? customParams.is_bot_marathon : false,
            marathon_force_order: customParams?.marathon_force_order !== undefined ? customParams.marathon_force_order : true,
            handicap_enforced: customParams?.handicap_enforced !== undefined ? customParams.handicap_enforced : false,
            handicap_starters: customParams?.handicap_starters !== undefined ? customParams.handicap_starters : null,
            handicap_starter_is_random: customParams?.handicap_starter_is_random !== undefined ? customParams.handicap_starter_is_random : false,
            is_shapeshifter: customParams?.is_shapeshifter !== undefined ? customParams.is_shapeshifter : false,
        };

        try {
            const data = await createChallenge(params);
            
            if (data) {
                // Extract invited profile details from custom params to invoke callback
                const invitedIds = customParams?.invitedIds || [];
                const invitedUsernames = customParams?.invitedUsernames || [];

                if (onChallengeCreated) {
                    onChallengeCreated(data, invitedUsernames, invitedIds);
                }

                triggerToast('Challenge created successfully!', 3000);
                queryClient.invalidateQueries({ queryKey: ['my-challenges'] });
                
                if (viewAfterCreate) {
                    await handleViewChallenge(data.id);
                }
            }
        } catch (e) {
            console.error('Failed to create challenge:', e);
            triggerToast('Failed to create challenge. Please try again.', 4000);
        }
    };

    const handleEdit = async (challengeId: string, updatedParams: any) => {
        try {
            await updateMutation.mutateAsync({ challengeId, params: updatedParams });
            triggerToast('Challenge updated successfully!', 3000);
            queryClient.invalidateQueries({ queryKey: ['my-challenges'] });
            
            // Refresh currently viewed challenge if it is the edited one
            if (selectedChallenge && selectedChallenge.id === challengeId) {
                await handleViewChallenge(challengeId);
            }
        } catch (e) {
            console.error('Failed to edit challenge:', e);
            triggerToast('Failed to update challenge.', 4000);
        }
    };

    const handleDelete = async (challengeId: string) => {
        try {
            await deleteMutation.mutateAsync(challengeId);
            triggerToast('Challenge deleted.', 3000);
            queryClient.invalidateQueries({ queryKey: ['my-challenges'] });
            
            if (selectedChallenge && selectedChallenge.id === challengeId) {
                setSelectedChallenge(null);
                setMyParticipation(null);
                setIsPlaying(false);
                setActiveTab('my');
            }
        } catch (e) {
            console.error('Failed to delete challenge:', e);
            triggerToast('Failed to delete challenge.', 4000);
        }
    };

    const handleStartGame = async () => {
        if (selectedChallenge && myParticipation) {
            try {
                await startMutation.mutateAsync(myParticipation.id);
                // Invalidate query to pull the fresh 'playing' status
                queryClient.invalidateQueries({ queryKey: ['my-challenges'] });
                await handleViewChallenge(selectedChallenge.id);
                setIsPlaying(true);
            } catch (e) {
                console.error('Failed to start challenge:', e);
                triggerToast('Failed to start the game.', 4000);
            }
        }
    };

    const toggleInvite = (id: string) => {
        if (invitedIds.includes(id)) {
            setInvitedIds(invitedIds.filter(i => i !== id));
        } else {
            setInvitedIds([...invitedIds, id]);
        }
    };

    const copyLink = (challenge: Challenge) => {
        const link = `${window.location.origin}?challenge=${challenge.id}`;
        navigator.clipboard.writeText(link)
            .then(() => triggerToast('Link copied to clipboard!', 2000))
            .catch(() => triggerToast('Failed to copy link.', 3000));
    };

    const shareLink = async (challenge: Challenge) => {
        const link = `${window.location.origin}?challenge=${challenge.id}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'WordUp Challenge Invitation',
                    text: `Join my WordUp Wordle challenge!`,
                    url: link
                });
            } catch (e) {
                console.warn('Share sheet dismissed or failed:', e);
            }
        } else {
            copyLink(challenge);
        }
    };

    const loadMyChallenges = async () => {
        await refetchChallenges();
    };

    const createChallenge = async (params: any) => {
        return createMutation.mutateAsync(params);
    };

    const cleanupSubscription = () => {
        // Real-time hook cleanup is handled internally by useChallenge when challengeId updates
    };

    const submitResult = useCallback(async (result: any, wordLength = 5, gameIndex?: number) => {
        if (!selectedChallenge || !myParticipation) return false;

        const isMarathon = selectedChallenge.salt?.endsWith('_marathon') || selectedChallenge.salt?.endsWith('_sentence');

        if (isMarathon && gameIndex !== undefined) {
            // Marathon sub-game submission path
            try {
                await marathonMutation.mutateAsync({
                    participationId: myParticipation.id,
                    gameIndex,
                    wordLength,
                    score: result.score || 0,
                    attempts: result.attempts || 0,
                    hintsUsed: result.hintsUsed || false,
                    timeTaken: result.timeTaken || 0,
                    status: result.status || 'completed',
                    guesses: result.guesses || []
                });

                // Re-evaluate if all marathon games have been played
                const parsedGames = parseMarathonGames(selectedChallenge.target_word, selectedChallenge.salt);
                const totalGames = parsedGames.length;

                // Sync current local progress update into cache list instantly to avoid waiting for query roundtrips
                const updatedMarathon = [...(myParticipation.marathon_progress || [])];
                const existingIdx = updatedMarathon.findIndex(p => p.game_index === gameIndex);
                const localProgressEntry = {
                    game_index: gameIndex,
                    word_length: wordLength,
                    status: result.status,
                    score: result.score,
                    attempts: result.attempts,
                    hints_used: result.hintsUsed,
                    time_taken: result.timeTaken,
                    guesses: result.guesses
                };

                if (existingIdx >= 0) {
                    updatedMarathon[existingIdx] = localProgressEntry;
                } else {
                    updatedMarathon.push(localProgressEntry);
                }

                let completedCount = 0;
                parsedGames.forEach(g => {
                    // Try exact match on gameIndex or fallback matching
                    const prog = updatedMarathon.find(p => p.game_index === g.gameIndex || p.game_index === (g as any).idx);
                    if (prog && (prog.status === 'completed' || prog.status === 'timed_out')) {
                        completedCount++;
                    }
                });

                const allCompleted = completedCount === totalGames;

                if (allCompleted) {
                    // Submit the final combined score to challenge_participants table to mark overall challenge completed
                    const totalScore = updatedMarathon.reduce((acc, curr) => acc + (curr.score || 0), 0);
                    const totalAttempts = updatedMarathon.reduce((acc, curr) => acc + (curr.attempts || 0), 0);
                    const totalTime = updatedMarathon.reduce((acc, curr) => acc + (curr.time_taken || 0), 0);
                    const anyHints = updatedMarathon.some(p => p.hints_used);

                    await submitMutation.mutateAsync({
                        participationId: myParticipation.id,
                        score: totalScore,
                        attempts: totalAttempts,
                        hintsUsed: anyHints,
                        timeTaken: totalTime,
                        status: 'completed' as const
                    });

                    // Trigger server refetch and update visual state
                    queryClient.invalidateQueries({ queryKey: ['my-challenges'] });
                    await handleViewChallenge(selectedChallenge.id);
                    setIsPlaying(false);
                } else {
                    // Not fully completed: update local state representation only
                    const updatedPart = {
                        ...myParticipation,
                        marathon_progress: updatedMarathon,
                        status: 'playing' as const
                    };
                    setMyParticipation(updatedPart);
                    
                    // Update TanStack Query cache directly to keep tabs in sync
                    const currentUser = effectiveUserRef.current;
                    if (currentUser) {
                        queryClient.setQueryData(['my-challenges', currentUser.id], (old: any) => {
                            if (!old) return old;
                            return old.map((item: any) => {
                                if (item.id === myParticipation.id) {
                                    return updatedPart;
                                }
                                return item;
                            });
                        });
                    }
                }

                return true;
            } catch (e) {
                console.error('Failed to submit marathon game result:', e);
                triggerToast('Failed to save sub-game result. Retrying...', 4000);
                return false;
            }
        } else {
            // Standard single-word challenge submission path
            try {
                await submitMutation.mutateAsync({
                    participationId: myParticipation.id,
                    score: result.score || 0,
                    attempts: result.attempts || 0,
                    hintsUsed: result.hintsUsed || false,
                    timeTaken: result.timeTaken || 0,
                    status: result.status || 'completed',
                    guesses: result.guesses || []
                });

                queryClient.invalidateQueries({ queryKey: ['my-challenges'] });
                await handleViewChallenge(selectedChallenge.id);
                setIsPlaying(false);
                return true;
            } catch (e) {
                console.error('Failed to submit challenge result:', e);
                triggerToast('Failed to save challenge result.', 4000);
                return false;
            }
        }
    }, [selectedChallenge, myParticipation, marathonMutation, submitMutation, queryClient, handleViewChallenge, setIsPlaying, setMyParticipation, triggerToast]);

    // Save and restore ChallengeView tab context to persist layout on navigations
    useEffect(() => {
        const view = loadChallengeView();
        if (view) {
            setActiveTab(view.activeTab);
            setListColumn(view.listColumn);
        }
    }, [setActiveTab, setListColumn]);

    useEffect(() => {
        saveChallengeView({ activeTab, listColumn });
    }, [activeTab, listColumn]);

    const contextValue = useMemo(() => ({
        activeTab,
        setActiveTab,
        isPlaying,
        setIsPlaying,
        isEditingChallenge,
        setIsEditingChallenge,
        mode,
        setMode,
        length,
        setLength,
        maxAttempts,
        setMaxAttempts,
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
        listColumn,
        setListColumn,
        handleViewChallenge,
        handleCreate,
        handleEdit,
        handleDelete,
        handleStartGame,
        toggleInvite,
        copyLink,
        shareLink,
        loadMyChallenges,
        submitResult,
        registerAnonymousUser,
        loading: isChallengesLoading || (listColumn === 'unplayed' && isDiscoverLoading) || createMutation.isPending || submitMutation.isPending || joinMutation.isPending || startMutation.isPending || marathonMutation.isPending || updateMutation.isPending || deleteMutation.isPending,
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
        backAction,
        setBackAction,
        activeGameLength,
        effectiveUser,
        loadingParticipants,
        participantsError,
        retryFetchParticipants,
        dailyMarathonChallenges,
        initialChallengeId,
        bootstrappingMessage,
        setBootstrappingMessage
    }), [
        activeTab, setActiveTab, isPlaying, setIsPlaying, mode, setMode, length, setLength, maxTime, setMaxTime, selectedChallenge, setSelectedChallenge, myParticipation, setMyParticipation, participants, myChallenges, availableProfiles, invitedIds, setInvitedIds, handleViewChallenge, handleCreate, handleEdit, handleDelete, handleStartGame, toggleInvite, triggerToast, refetchChallenges, submitResult, isChallengesLoading, isDiscoverLoading, createMutation.isPending, submitMutation.isPending, joinMutation.isPending, startMutation.isPending, marathonMutation.isPending, updateMutation.isPending, deleteMutation.isPending, joinId, setJoinId, previewParticipant, setPreviewParticipant, previewMarathonLength, setPreviewMarathonLength, previewMarathonGameIndex, setPreviewMarathonGameIndex, backAction, setBackAction, activeGameLength, registerAnonymousUser, effectiveUser, isEditingChallenge, setIsEditingChallenge, loadingParticipants, participantsError, retryFetchParticipants, dailyMarathonChallenges, initialChallengeId, bootstrappingMessage
    ]);

    return (
        <ChallengeContext.Provider value={contextValue}>
            <ChallengeFiltersProvider>
                {children}
            </ChallengeFiltersProvider>
        </ChallengeContext.Provider>
    );
};
