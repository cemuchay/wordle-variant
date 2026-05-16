/* eslint-disable @typescript-eslint/no-explicit-any */

import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getServerDate } from '../lib/time';
import { type GameStats } from '../types/game';
import { useGlobalPresence, type PresenceUser } from '../hooks/useGlobalPresence';
import { useAudioChat, type AudioChatState } from '../hooks/useAudioChat';

interface UserPreferences {
    allowRoasts: boolean;
    theme: 'dark' | 'light';
    compactMode: boolean;
}

const INITIAL_STATS: GameStats = {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    guesses: { "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6": 0, "7": 0, X: 0 },
};

interface AppContextType {
    profile: any | null;
    preferences: UserPreferences;
    loading: boolean;
    refreshProfile: () => Promise<void>;
    toast: {
        show: boolean, message: string, duration: number | undefined
    };
    triggerToast: ((msg: string, duration?: number) => any);
    setToast: any;
    unreadCount: number;
    setUnreadCount: (val: number) => void;
    challengeUnreadCount: number;
    setChallengeUnreadCount: (val: number) => void;
    date: string | null;
    isLoadingDate: boolean;
    setIsLoadingDate: any;
    stats: GameStats;
    setStats: (stats: GameStats) => void;
    activeCall: { challengeId: string, userId: string, isInitiator?: boolean } | null;
    setActiveCall: (call: { challengeId: string, userId: string, isInitiator?: boolean } | null) => void;
    isChallengeOpen: boolean;
    setIsChallengeOpen: (val: boolean) => void;
    isChatOpen: boolean;
    setIsChatOpen: (val: boolean) => void;

    // Global Presence & Audio Chat
    onlineUsers: PresenceUser[];
    allProfiles: PresenceUser[];
    audioChat: AudioChatState;
    activeVoiceRooms: { challengeId: string, user: PresenceUser }[];
}

const defaultPreferences: UserPreferences = {
    allowRoasts: true,
    theme: 'dark',
    compactMode: false,
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
    const [profile, setProfile] = useState<any | null>(null);
    const [preferences, setPreferences] = useState<UserPreferences>(defaultPreferences);
    const [loading, setLoading] = useState(true);
    const [unreadCount, setUnreadCount] = useState(0);
    const [challengeUnreadCount, setChallengeUnreadCount] = useState(0);
    const [stats, setStats] = useState<GameStats>(INITIAL_STATS);
    const [activeCall, setActiveCall] = useState<{ challengeId: string, userId: string, isInitiator?: boolean } | null>(null);
    const [isChallengeOpen, setIsChallengeOpen] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.has('challenge');
    });
    const [isChatOpen, setIsChatOpen] = useState(false);

    const [myParticipations, setMyParticipations] = useState<string[]>([]);

    const [toast, setToast] = useState<{
        show: boolean, message: string, duration: number | undefined
    }>({ show: false, message: "", duration: undefined });

    const triggerToast = (msg: string, duration?: number) => setToast({ show: true, message: msg, duration: duration });

    // Global Presence Hook
    const { onlineUsers, allProfiles } = useGlobalPresence(profile?.id, activeCall?.challengeId || null);

    // Global Audio Chat Hook
    const audioChat = useAudioChat({
        challengeId: activeCall?.challengeId || '',
        userId: profile?.id || '',
        enabled: !!activeCall
    });

    // Compute Active Voice Rooms (filtered by my participations OR global room)
    const activeVoiceRooms = onlineUsers
        .filter(u => u.id !== profile?.id && u.activeVoiceRoomId && (u.activeVoiceRoomId === 'global' || myParticipations.includes(u.activeVoiceRoomId)))
        .map(u => ({ challengeId: u.activeVoiceRoomId!, user: u }));

    // Fetch my participations to filter active voice rooms
    const fetchMyParticipations = useCallback(async () => {
        if (!profile?.id) return;
        const { data } = await supabase
            .from('challenge_participants')
            .select('challenge_id')
            .eq('user_id', profile.id);
        if (data) setMyParticipations(data.map(p => p.challenge_id));
    }, [profile?.id]);

    useEffect(() => {
        fetchMyParticipations();
    }, [fetchMyParticipations]);

    // Live Challenge Unread Counter
    const refreshChallengeUnreadCount = useCallback(async () => {
        if (!profile?.id) return;
        try {
            const { data } = await supabase
                .from('challenge_participants')
                .select('status, challenge:challenges(expires_at)')
                .eq('user_id', profile.id);
            
            if (data) {
                const count = data.filter((c: any) => 
                    (c.status === 'pending' || c.status === 'playing') && 
                    new Date(c.challenge.expires_at) > new Date()
                ).length;
                setChallengeUnreadCount(count);
                // Also update participations list for voice filtering
                setMyParticipations(data.map((p: any) => p.challenge_id));
            }
        } catch (err) {
            console.error('Error refreshing challenge unread count:', err);
        }
    }, [profile?.id]);

    useEffect(() => {
        if (!profile?.id) return;

        refreshChallengeUnreadCount();

        const channel = supabase
            .channel(`unread_challenges_${profile.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'challenge_participants',
                filter: `user_id=eq.${profile.id}`
            }, () => {
                refreshChallengeUnreadCount();
                fetchMyParticipations();
            })
            .subscribe();
        
        return () => {
            supabase.removeChannel(channel);
        };
    }, [profile?.id, refreshChallengeUnreadCount, fetchMyParticipations]);

    const fetchProfile = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setLoading(false);
                return;
            }

            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (!error && data) {
                setProfile(data);
                setPreferences({
                    ...defaultPreferences,
                    ...(data.preferences as object),
                });
            }
        } catch (err) {
            console.error('Error fetching profile:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
            fetchProfile();
        });

        return () => subscription.unsubscribe();
    }, []);

    const [date, setDate] = useState<string | null>(null);
    const [isLoadingDate, setIsLoadingDate] = useState(true);

    useEffect(() => {
        const syncTime = async () => {
            try {
                const serverDate = await getServerDate();
                setDate(prev => prev !== serverDate.formatted ? serverDate.formatted : prev);
                setIsLoadingDate(false);
            } catch (err) {
                console.error("Initialization error:", err);
                triggerToast("Error fetching date from server, refresh page")
            }
        };

        syncTime();
    }, []);

    return (
        <AppContext.Provider value={{
            profile,
            preferences,
            loading,
            refreshProfile: fetchProfile,
            toast,
            triggerToast,
            setToast,
            unreadCount,
            setUnreadCount,
            challengeUnreadCount,
            setChallengeUnreadCount,
            date,
            isLoadingDate,
            setIsLoadingDate,
            stats,
            setStats,
            activeCall,
            setActiveCall,
            isChallengeOpen,
            setIsChallengeOpen,
            isChatOpen,
            setIsChatOpen,
            onlineUsers,
            allProfiles,
            audioChat,
            activeVoiceRooms
        }}>
            {children}
        </AppContext.Provider>
    );
};

export const useApp = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};