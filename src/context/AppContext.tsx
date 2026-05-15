/* eslint-disable @typescript-eslint/no-explicit-any */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
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
    activeCall: { challengeId: string, userId: string } | null;
    setActiveCall: (call: { challengeId: string, userId: string } | null) => void;
    isChallengeOpen: boolean;
    setIsChallengeOpen: (val: boolean) => void;

    // Global Presence & Audio Chat
    onlineUsers: PresenceUser[];
    allProfiles: PresenceUser[];
    incomingCall: { from: PresenceUser, challengeId: string } | null;
    setIncomingCall: (call: { from: PresenceUser, challengeId: string } | null) => void;
    audioChat: AudioChatState;
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
    const [activeCall, setActiveCall] = useState<{ challengeId: string, userId: string } | null>(null);
    const [isChallengeOpen, setIsChallengeOpen] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return params.has('challenge');
    });

    const [toast, setToast] = useState<{
        show: boolean, message: string, duration: number | undefined
    }>({ show: false, message: "", duration: undefined });

    const triggerToast = (msg: string, duration?: number) => setToast({ show: true, message: msg, duration: duration });

    // Global Presence Hook
    const { onlineUsers, allProfiles, incomingCall, setIncomingCall, sendIncomingCall } = useGlobalPresence(profile?.id);

    // Global Audio Chat Hook
    const audioChat = useAudioChat({
        challengeId: activeCall?.challengeId || '',
        userId: profile?.id || '',
        enabled: !!activeCall
    });

    // Handle sending invitations when a call is started
    useEffect(() => {
        if (activeCall && audioChat.logs.length > 0) {
            const hasJoined = audioChat.logs.some(l => l.message.includes('Joining audio channel'));
            const hasNotified = audioChat.logs.some(l => l.message.includes('Notification sent'));

            if (hasJoined && !hasNotified) {
                sendIncomingCall(activeCall.challengeId);
                audioChat.addLog('Notification sent to other party', 'success');
            }
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeCall, audioChat.logs, sendIncomingCall, audioChat.addLog]);

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
        // eslint-disable-next-line react-hooks/set-state-in-effect
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
            onlineUsers,
            allProfiles,
            incomingCall,
            setIncomingCall,
            audioChat
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