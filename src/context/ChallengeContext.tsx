/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext, useState, useEffect, useCallback, useMemo, ReactNode, useRef } from 'react';
import { useChallenge, type Challenge, type ChallengeParticipant } from '../hooks/useChallenge';
import { useApp } from './AppContext';
import { deobfuscateWord, calculateSkillIndex } from '../lib/game-logic';
import { supabase } from '../lib/supabaseClient';

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
    lengthFilter: 'ALL' | number; // number 3-7 or 1 for marathon
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
    timeLeft: number | null;
    setTimeLeft: (t: number | null) => void;
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
    const challengeApi = useChallenge(user);
    const { 
        createChallenge, fetchChallenge, joinChallenge, subscribeToParticipants, 
        participants, fetchMyChallenges, fetchProfiles, loading, error, 
        startChallenge, submitChallengeResult, submitMarathonResult 
    } = challengeApi;

    // UI & Navigation
    const [activeTab, setActiveTab] = useState<'my' | 'create' | 'join'>('my');
    const [isPlaying, setIsPlaying] = useState(false);
    const [joinId, setJoinId] = useState('');
    const [previewParticipant, setPreviewParticipant] = useState<ChallengeParticipant | null>(null);

    // Form State
    const [mode, setMode] = useState<'LIVE' | 'ANYTIME'>('ANYTIME');
    const [length, setLength] = useState(5);
    const [maxTime, setMaxTime] = useState<number | null>(null);

    // Selection State
    const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null);
    const [myParticipation, setMyParticipation] = useState<ChallengeParticipant | null>(null);
    const latestParticipationRef = useRef<ChallengeParticipant | null>(null);

    // Keep ref in sync with state
    useEffect(() => {
        latestParticipationRef.current = myParticipation;
    }, [myParticipation]);

    const [myChallenges, setMyChallenges] = useState<any[]>([]);
    const [availableProfiles, setAvailableProfiles] = useState<any[]>([]);
    const [invitedIds, setInvitedIds] = useState<string[]>([]);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');
    const [modeFilter, setModeFilter] = useState<'ALL' | 'LIVE' | 'ANYTIME'>('ALL');
    const [lengthFilter, setLengthFilter] = useState<'ALL' | number>('ALL');

    const clearFilters = useCallback(() => {
        setSearchQuery('');
        setStatusFilter('ALL');
        setModeFilter('ALL');
        setLengthFilter('ALL');
    }, []);

    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const [backAction, setBackAction] = useState<(() => void) | null>(null);

    const channelRef = useRef<any>(null);
    const initialProcessed = useRef(false);

    // Adjust maxTime defaults based on mode
    useEffect(() => {
        if (mode === 'LIVE') setMaxTime(5);
        else setMaxTime(null);
    }, [mode]);

    // Sync status with AppContext unread count
    const unplayedCount = useMemo(() =>
        myChallenges.filter(c => (c.status === 'pending' || c.status === 'playing') && new Date(c.challenge.expires_at) > new Date()).length,
        [myChallenges]
    );

    useEffect(() => {
        setChallengeUnreadCount(unplayedCount);
    }, [unplayedCount, setChallengeUnreadCount]);

    // Derived State: Filtered Challenges
    const filteredChallenges = useMemo(() => {
        return myChallenges.filter(item => {
            const challenge = item.challenge;
            const isExpired = new Date(challenge.expires_at) < new Date();
            const isFinished = item.status === 'completed' || item.status === 'timed_out' || item.status === 'declined';

            // Status Filter
            if (statusFilter === 'ACTIVE' && (isFinished || isExpired)) return false;
            if (statusFilter === 'COMPLETED' && !isFinished && !isExpired) return false;

            // Mode Filter
            if (modeFilter !== 'ALL' && challenge.mode !== modeFilter) return false;

            // Length Filter
            if (lengthFilter !== 'ALL' && challenge.word_length !== lengthFilter) return false;

            // Search Filter
            if (searchQuery) {
                const opponentNames = challenge.participants
                    ?.filter((p: any) => p.user_id !== user?.id)
                    .map((p: any) => p.profiles?.username?.toLowerCase() || '')
                    .join(' ');
                if (!opponentNames.includes(searchQuery.toLowerCase())) return false;
            }
            return true;
        });
    }, [myChallenges, statusFilter, modeFilter, lengthFilter, searchQuery, user?.id]);

    const submitResult = useCallback(async (result: any, wordLength?: number) => {
        if (!myParticipation) return false;

        const isMarathon = selectedChallenge?.word_length === 1;
        let finalUpdateData: any;

        if (isMarathon && wordLength) {
            // 1. Update the sub-game progress in the new table
            const success = await submitMarathonResult(myParticipation.id, wordLength, result);
            if (!success) return false;

            // 2. Recalculate totals for the main participation record
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
            let completedCount = 0;
            const lengths = [3, 4, 5, 6, 7];

            lengths.forEach(l => {
                const prog = updatedMarathon.find(p => p.word_length === l);
                if (prog) {
                    totalAttempts += prog.attempts || 0;
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
                status: allCompleted ? 'completed' : 'playing',
                hints_used: updatedMarathon.some(p => p.hints_used),
                marathon_progress: updatedMarathon // Optimistic sync
            };
        } else {
            finalUpdateData = { ...result };
        }

        // OPTIMISTIC UPDATE: Update local state immediately
        setMyParticipation(prev => prev ? { ...prev, ...finalUpdateData } : prev);

        // 3. Update the main participation record in DB
        return await submitChallengeResult(myParticipation.id, finalUpdateData);
    }, [myParticipation, selectedChallenge?.word_length, submitChallengeResult, submitMarathonResult]);

    // Lifecycle: Load Data
    const loadMyChallenges = useCallback(async () => {
        const data = await fetchMyChallenges();
        setMyChallenges(data);
    }, [fetchMyChallenges]);

    const loadProfiles = useCallback(async () => {
        const profiles = await fetchProfiles();
        setAvailableProfiles(profiles.filter((p: any) => p.id !== user?.id));
    }, [fetchProfiles, user?.id]);

    useEffect(() => {
        if (initialChallengeId && !initialProcessed.current) {
            initialProcessed.current = true;
            handleViewChallenge(initialChallengeId);
        } else {
            loadMyChallenges();
            loadProfiles();
        }
    }, [user?.id]); // Re-load when user changes

    // Sync myParticipation and previewParticipant from the participants array (real-time updates)
    useEffect(() => {
        if (participants.length > 0 && user) {
            const currentFromServer = participants.find(p => p.user_id === user.id);
            const isMarathon = selectedChallenge?.word_length === 1;
            
            if (currentFromServer) {
                // Determine if server data is different from local state
                const isDifferent = 
                    JSON.stringify(currentFromServer.guesses) !== JSON.stringify(myParticipation?.guesses) ||
                    JSON.stringify(currentFromServer.marathon_progress) !== JSON.stringify(myParticipation?.marathon_progress) ||
                    currentFromServer.status !== myParticipation?.status ||
                    currentFromServer.score !== myParticipation?.score;

                if (!isPlaying || isDifferent) {
                    // If we are playing, we only sync if the server has MORE progress
                    if (isPlaying) {
                        let shouldSync = false;
                        if (isMarathon) {
                            const serverSubCount = currentFromServer.marathon_progress?.length || 0;
                            const localSubCount = myParticipation?.marathon_progress?.length || 0;
                            const serverGuessCount = currentFromServer.marathon_progress?.reduce((acc, p) => acc + (p.guesses?.length || 0), 0) || 0;
                            const localGuessCount = myParticipation?.marathon_progress?.reduce((acc, p) => acc + (p.guesses?.length || 0), 0) || 0;
                            
                            shouldSync = serverSubCount > localSubCount || serverGuessCount > localGuessCount;
                        } else {
                            const serverGuessCount = currentFromServer.guesses?.length || 0;
                            const localGuessCount = myParticipation?.guesses?.length || 0;
                            shouldSync = serverGuessCount > localGuessCount;
                        }

                        if (shouldSync) setMyParticipation(currentFromServer);
                    } else {
                        setMyParticipation(currentFromServer);
                    }
                }
            }
            
            if (previewParticipant) {
                const updated = participants.find(p => p.id === previewParticipant.id);
                if (updated) setPreviewParticipant(updated);
            }
        }
    }, [participants, user?.id, isPlaying, selectedChallenge?.word_length]);

    const cleanupSubscription = useCallback(() => {
        if (channelRef.current) {
            supabase.removeChannel(channelRef.current);
            channelRef.current = null;
        }
    }, []);

    useEffect(() => cleanupSubscription, [cleanupSubscription]);

    // Action Handlers
    const handleViewChallenge = useCallback(async (id: string) => {
        const challenge = await fetchChallenge(id);
        if (challenge) {
            if (new Date(challenge.expires_at) < new Date()) {
                triggerToast("This challenge has expired.", 4000);
                return;
            }
            cleanupSubscription();
            setSelectedChallenge(challenge);
            const participation = await joinChallenge(challenge.id);
            setMyParticipation(participation);
            setActiveTab('join');
            channelRef.current = subscribeToParticipants(challenge.id);
        } else {
            triggerToast("Invalid challenge link or code.", 4000);
        }
    }, [cleanupSubscription, triggerToast, fetchChallenge, joinChallenge, subscribeToParticipants]);

    const handleCreate = useCallback(async () => {
        const challenge = await createChallenge(mode, length, mode === 'LIVE' ? maxTime : null, invitedIds);
        if (challenge) {
            const invitedUsernames = availableProfiles
                .filter(p => invitedIds.includes(p.id))
                .map(p => p.username);
            if (onChallengeCreated) onChallengeCreated(challenge, invitedUsernames, invitedIds);
            
            // Reset Form Defaults
            setMode('ANYTIME');
            setLength(5);
            setMaxTime(null);
            setInvitedIds([]);
            
            handleViewChallenge(challenge.id);
        }
    }, [mode, length, maxTime, invitedIds, availableProfiles, createChallenge, onChallengeCreated, handleViewChallenge]);

    const handleStartGame = useCallback(async () => {
        if (!selectedChallenge || !myParticipation) return;
        
        let updatedChallenge = { ...selectedChallenge };

        if (selectedChallenge.word_length === 1) {
            try {
                const obfuscatedWords = JSON.parse(selectedChallenge.target_word);
                const plainWords: Record<number, string> = {};
                Object.entries(obfuscatedWords).forEach(([len, word]) => {
                    plainWords[Number(len)] = deobfuscateWord(word as string, selectedChallenge.salt);
                });
                updatedChallenge.target_word = JSON.stringify(plainWords);
            } catch (e) {
                console.error("Failed to parse marathon words", e);
            }
        } else {
            updatedChallenge.target_word = deobfuscateWord(selectedChallenge.target_word, selectedChallenge.salt);
        }

        setSelectedChallenge(updatedChallenge);
        if (myParticipation.status === 'pending') await startChallenge(myParticipation.id);
        setIsPlaying(true);
    }, [selectedChallenge, myParticipation, startChallenge]);

    const toggleInvite = useCallback((id: string) => {
        setInvitedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
    }, []);

    const copyLink = useCallback((challenge: Challenge) => {
        const url = `${window.location.origin}${window.location.pathname}?challenge=${challenge.id}`;
        const text = `Hey! I challenge you to a ${challenge.word_length === 1 ? 'Marathon' : challenge.word_length + '-letter Wordle'} match (${challenge.mode} mode)! 🏆\n\nJoin here: ${url}`;
        navigator.clipboard.writeText(text);
        triggerToast('Challenge link copied to clipboard!', 2000);
    }, [triggerToast]);

    return (
        <ChallengeContext.Provider value={{
            activeTab, setActiveTab,
            isPlaying, setIsPlaying,
            mode, setMode,
            length, setLength,
            maxTime, setMaxTime,
            selectedChallenge, setSelectedChallenge,
            myParticipation,
            participants,
            myChallenges,
            availableProfiles,
            invitedIds,
            searchQuery, setSearchQuery,
            statusFilter, setStatusFilter,
            modeFilter, setModeFilter,
            lengthFilter, setLengthFilter,
            clearFilters,
            filteredChallenges,
            handleViewChallenge,
            handleCreate,
            handleStartGame,
            toggleInvite,
            copyLink,
            loadMyChallenges,
            submitResult,
            loading,
            error,
            joinId, setJoinId,
            submitChallengeResult,
            startChallenge,
            previewParticipant,
            setPreviewParticipant,
            unplayedCount,
            timeLeft,
            setTimeLeft,
            backAction,
            setBackAction
        }}>
            {children}
        </ChallengeContext.Provider>
    );
};

export const useChallengeContext = () => {
    const context = useContext(ChallengeContext);
    if (context === undefined) {
        throw new Error('useChallengeContext must be used within a ChallengeProvider');
    }
    return context;
};
