/* eslint-disable @typescript-eslint/no-explicit-any */

import { createContext, useContext, useEffect, useState, type ReactNode, useMemo } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useGlobalPresence, type PresenceUser } from '../hooks/useGlobalPresence';
import { useAudioChat, type AudioChatState } from '../hooks/useAudioChat';
import { useAppStore } from '../store/useAppStore';
import { useAuthoritativeDate, useProfile, useChallengeStatus } from '../hooks/queries/useServerData';
import { useAppInit } from '../hooks/useAppInit';

interface AppContextType {
    profile: any | null;
    preferences: any;
    loading: boolean;
    refreshProfile: () => Promise<void>;
    toast: { show: boolean; message: string; duration?: number };
    triggerToast: (msg: string, duration?: number) => void;
    setToast: any;
    unreadCount: number;
    setUnreadCount: (val: number) => void;
    challengeUnreadCount: number;
    setChallengeUnreadCount: (val: number) => void;
    date: string | null;
    isLoadingDate: boolean;
    setIsLoadingDate: any;
    stats: any;
    setStats: (stats: any) => void;
    activeCall: any;
    setActiveCall: (call: any) => void;
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

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
        return () => subscription.unsubscribe();
    }, []);

    // 1. Initialize Auth and Real-time Listeners
    useAppInit();

    // 2. Client-Side State (Destructured Selectors for stability)
    const preferences = useAppStore(s => s.preferences);
    const setPreferences = useAppStore(s => s.setPreferences);
    const toast = useAppStore(s => s.toast);
    const triggerToast = useAppStore(s => s.triggerToast);
    const setToast = useAppStore(s => s.setToast);
    const unreadCount = useAppStore(s => s.unreadCount);
    const setUnreadCount = useAppStore(s => s.setUnreadCount);
    const challengeUnreadCount = useAppStore(s => s.challengeUnreadCount);
    const setChallengeUnreadCount = useAppStore(s => s.setChallengeUnreadCount);
    const stats = useAppStore(s => s.stats);
    const setStats = useAppStore(s => s.setStats);
    const activeCall = useAppStore(s => s.activeCall);
    const setActiveCall = useAppStore(s => s.setActiveCall);
    const isChallengeOpen = useAppStore(s => s.isChallengeOpen);
    const setIsChallengeOpen = useAppStore(s => s.setChallengeOpen);
    const isChatOpen = useAppStore(s => s.isChatOpen);
    const setIsChatOpen = useAppStore(s => s.setChatOpen);
    const setIsLoadingDate = useAppStore(s => s.setIsLoadingDate);
    const myParticipations = useAppStore(s => s.myParticipations);
    const setMyParticipations = useAppStore(s => s.setMyParticipations);

    // 3. Server-Side State (TanStack Query)
    const { data: serverDateResponse, isLoading: isLoadingDate } = useAuthoritativeDate();
    const { data: profile, isLoading: isProfileLoading } = useProfile(user?.id);

    const { data: challengeStatus } = useChallengeStatus(user?.id);

    // 4. Presence & Audio Logic
    const { onlineUsers, allProfiles } = useGlobalPresence(user?.id, activeCall?.challengeId || null);
    const audioChat = useAudioChat({
        challengeId: activeCall?.challengeId || '',
        userId: user?.id || '',
        enabled: !!activeCall
    });

    // 5. Computed State
    const activeVoiceRooms = useMemo(() => {
        return onlineUsers
            .filter(u => u.id !== user?.id && u.activeVoiceRoomId && (u.activeVoiceRoomId === 'global' || myParticipations.includes(u.activeVoiceRoomId)))
            .map(u => ({ challengeId: u.activeVoiceRoomId!, user: u }));
    }, [onlineUsers, user?.id, myParticipations]);

    // 6. Sync Query data with Store (Bridge)
    useEffect(() => {
        if (challengeStatus) {
            setChallengeUnreadCount(challengeStatus.unreadCount);
            setMyParticipations(challengeStatus.participations);
        }
    }, [challengeStatus, setChallengeUnreadCount, setMyParticipations]);

    useEffect(() => {
        if (profile?.preferences) {
            setPreferences(profile.preferences);
        }
    }, [profile, setPreferences]);

    // 7. Context Bridge (Ensures existing components don't break)
    const contextValue: AppContextType = useMemo(() => ({
        profile,
        preferences,
        loading: isProfileLoading,
        refreshProfile: async () => { /* Handled by cache invalidation in Init hook */ },
        toast,
        triggerToast,
        setToast,
        unreadCount,
        setUnreadCount,
        challengeUnreadCount,
        setChallengeUnreadCount,
        date: serverDateResponse?.formatted || null,
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
    }), [
        profile, preferences, isProfileLoading, toast, triggerToast,
        setToast, unreadCount, setUnreadCount, challengeUnreadCount,
        setChallengeUnreadCount, serverDateResponse?.formatted, isLoadingDate,
        setIsLoadingDate, stats, setStats, activeCall,
        setActiveCall, isChallengeOpen, setIsChallengeOpen,
        isChatOpen, setIsChatOpen, onlineUsers, allProfiles,
        audioChat, activeVoiceRooms
    ]);

    return (
        <AppContext.Provider value={contextValue}>
            {children}
        </AppContext.Provider>
    );
};

// eslint-disable-next-line react-refresh/only-export-components
export const useApp = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};
