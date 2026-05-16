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
    filteredChallenges: any[];
    
    // Actions
    handleViewChallenge: (id: string) => Promise<void>;
    handleCreate: () => Promise<void>;
    handleStartGame: () => Promise<void>;
    toggleInvite: (id: string) => void;
    copyLink: (challenge: Challenge) => void;
    loadMyChallenges: () => Promise<void>;
    submitResult: (result: any) => Promise<boolean>;
    
    // Helpers
    loading: boolean;
    error: string | null;
    joinId: string;
    setJoinId: (id: string) => void;
    submitChallengeResult: any;
    startChallenge: any;
    previewParticipant: ChallengeParticipant | null;
    setPreviewParticipant: (p: ChallengeParticipant | null) => void;
    unplayedCount: number;
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
        startChallenge, submitChallengeResult 
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
    const [myChallenges, setMyChallenges] = useState<any[]>([]);
    const [availableProfiles, setAvailableProfiles] = useState<any[]>([]);
    const [invitedIds, setInvitedIds] = useState<string[]>([]);

    // Search & Filter State
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'COMPLETED'>('ALL');

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
            const isExpired = new Date(item.challenge.expires_at) < new Date();
            const isFinished = item.status === 'completed' || item.status === 'timed_out' || item.status === 'declined';

            if (statusFilter === 'ACTIVE' && (isFinished || isExpired)) return false;
            if (statusFilter === 'COMPLETED' && !isFinished && !isExpired) return false;

            if (searchQuery) {
                const opponentNames = item.challenge.participants
                    ?.filter((p: any) => p.user_id !== user?.id)
                    .map((p: any) => p.profiles?.username?.toLowerCase() || '')
                    .join(' ');
                if (!opponentNames.includes(searchQuery.toLowerCase())) return false;
            }
            return true;
        });
    }, [myChallenges, statusFilter, searchQuery, user?.id]);

    const submitResult = useCallback(async (result: any) => {
        if (!myParticipation) return false;

        const isMarathon = selectedChallenge?.word_length === 1;
        let mergedResult: any = { ...result };

        // Helper to calculate totals for Marathon
        const calculateMarathonTotals = (currentGuesses: any, currentHints: any) => {
            let totalScore = 0;
            let totalAttempts = 0;
            let allCompleted = true;
            const lengths = [3, 4, 5, 6, 7];

            lengths.forEach(l => {
                const guesses = currentGuesses[l] || [];
                const hints = currentHints[l] || {};
                const won = guesses.some((g: any) => g.every((r: any) => r.status === 'correct'));
                const lost = !won && guesses.length >= 6;
                
                totalAttempts += guesses.length;
                if (won || lost) {
                    totalScore += calculateSkillIndex(guesses.length, 6, hints.used || false, guesses);
                } else {
                    allCompleted = false;
                }
            });

            return { totalScore, totalAttempts, allCompleted };
        };
        
        setMyParticipation(prev => {
            if (!prev) return prev;
            
            if (isMarathon) {
                const updatedGuesses = { ...(prev.guesses || {}), ...(result.guesses || {}) };
                const updatedHints = { ...(prev.hint_record || {}), ...(result.hint_record || {}) };
                const { totalScore, totalAttempts, allCompleted } = calculateMarathonTotals(updatedGuesses, updatedHints);
                
                mergedResult = {
                    ...result,
                    guesses: updatedGuesses,
                    hint_record: updatedHints,
                    score: totalScore,
                    attempts: totalAttempts,
                    status: allCompleted ? 'completed' : 'playing',
                    hints_used: Object.values(updatedHints).some((h: any) => h.used)
                };
            }
            
            return { ...prev, ...mergedResult };
        });

        // Re-calculate for API call to ensure we don't use stale closure values
        if (isMarathon) {
            const updatedGuesses = { ...(myParticipation.guesses || {}), ...(result.guesses || {}) };
            const updatedHints = { ...(myParticipation.hint_record || {}), ...(result.hint_record || {}) };
            const { totalScore, totalAttempts, allCompleted } = calculateMarathonTotals(updatedGuesses, updatedHints);
            
            mergedResult = {
                ...result,
                guesses: updatedGuesses,
                hint_record: updatedHints,
                score: totalScore,
                attempts: totalAttempts,
                status: allCompleted ? 'completed' : 'playing',
                hints_used: Object.values(updatedHints).some((h: any) => h.used)
            };
        }

        return await submitChallengeResult(myParticipation.id, mergedResult);
    }, [myParticipation, selectedChallenge, submitChallengeResult]);

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
            const current = participants.find(p => p.user_id === user.id);
            if (current) setMyParticipation(current);
            
            if (previewParticipant) {
                const updated = participants.find(p => p.id === previewParticipant.id);
                if (updated) setPreviewParticipant(updated);
            }
        }
    }, [participants, user?.id, previewParticipant?.id]);

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
            filteredChallenges,
            handleViewChallenge,
            handleCreate,
            handleStartGame,
            toggleInvite,
            copyLink,
            loadMyChallenges,
            loading,
            error,
            joinId, setJoinId,
            submitChallengeResult,
            startChallenge,
            previewParticipant,
            setPreviewParticipant,
            unplayedCount
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
