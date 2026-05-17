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

    // 2. Client-Side State (Zustand Selectors)
    const store = useAppStore(); // Keep for the context bridge
    const setChallengeUnreadCount = useAppStore(state => state.setChallengeUnreadCount);
    const setMyParticipations = useAppStore(state => state.setMyParticipations);
    const setPreferences = useAppStore(state => state.setPreferences);
    const myParticipations = useAppStore(state => state.myParticipations);

    // 3. Server-Side State (TanStack Query)
    const { data: serverDateResponse, isLoading: isLoadingDate } = useAuthoritativeDate();
    const { data: profile, isLoading: isProfileLoading } = useProfile(user?.id);

    const { data: challengeStatus } = useChallengeStatus(user?.id);

    // 4. Presence & Audio Logic
    const { onlineUsers, allProfiles } = useGlobalPresence(user?.id, store.activeCall?.challengeId || null);
    const audioChat = useAudioChat({
        challengeId: store.activeCall?.challengeId || '',
        userId: user?.id || '',
        enabled: !!store.activeCall
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
        preferences: store.preferences,
        loading: isProfileLoading,
        refreshProfile: async () => { /* Handled by cache invalidation in Init hook */ },
        toast: store.toast,
        triggerToast: store.triggerToast,
        setToast: store.setToast,
        unreadCount: store.unreadCount,
        setUnreadCount: store.setUnreadCount,
        challengeUnreadCount: store.challengeUnreadCount,
        setChallengeUnreadCount: store.setChallengeUnreadCount,
        date: serverDateResponse?.formatted || null,
        isLoadingDate,
        setIsLoadingDate: store.setIsLoadingDate,
        stats: store.stats,
        setStats: store.setStats,
        activeCall: store.activeCall,
        setActiveCall: store.setActiveCall,
        isChallengeOpen: store.isChallengeOpen,
        setIsChallengeOpen: store.setChallengeOpen,
        isChatOpen: store.isChatOpen,
        setIsChatOpen: store.setChatOpen,
        onlineUsers,
        allProfiles,
        audioChat,
        activeVoiceRooms
    }), [
        profile, store.preferences, isProfileLoading, store.toast, store.triggerToast,
        store.setToast, store.unreadCount, store.setUnreadCount, store.challengeUnreadCount,
        store.setChallengeUnreadCount, serverDateResponse?.formatted, isLoadingDate,
        store.setIsLoadingDate, store.stats, store.setStats, store.activeCall,
        store.setActiveCall, store.isChallengeOpen, store.setChallengeOpen,
        store.isChatOpen, store.setChatOpen, onlineUsers, allProfiles,
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
