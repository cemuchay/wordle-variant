/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext, useContext } from 'react';
import type { PresenceUser } from '../hooks/useGlobalPresence';
import type { AudioChatState } from '../hooks/useAudioChat';
import type { VoiceCallState } from '../store/useAppStore';

export interface AppContextType {
    profile: any | null;
    preferences: any;
    loading: boolean;
    refreshProfile: () => Promise<void>;
    toast: { show: boolean; message: string; duration?: number; isLarge?: boolean };
    triggerToast: (msg: string, duration?: number, isLarge?: boolean) => void;
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
    activeCall: VoiceCallState | null;
    setActiveCall: (call: VoiceCallState | null) => void;
    isChallengeOpen: boolean;
    setIsChallengeOpen: (val: boolean) => void;
    isNotificationsOpen: boolean;
    setIsNotificationsOpen: (val: boolean) => void;
    isChatOpen: boolean;
    setIsChatOpen: (val: boolean) => void;
    isChatConversationOpen: boolean;

    // Call Signaling Helpers
    initiatePrivateCall: (targetUser: { id: string; username: string; avatar_url: string }) => void;
    acceptCall: () => void;
    rejectCall: () => void;
    hangUpCall: () => void;

    // Global Presence & Audio Chat
    onlineUsers: PresenceUser[];
    allProfiles: PresenceUser[];
    audioChat: AudioChatState;
    activeVoiceRooms: { challengeId: string, user: PresenceUser }[];
    realtimeStatus: 'connected' | 'disconnected';
    isDynamicIslandVisible: boolean;

    // WordUp Direct Invite State
    incomingWordUpInvite: { senderId: string; senderName: string; category: string } | null;
    setIncomingWordUpInvite: (invite: { senderId: string; senderName: string; category: string } | null) => void;
    incomingAsyncInvite: { senderId: string; senderName: string; category: string; matchId: string } | null;
    setIncomingAsyncInvite: (invite: { senderId: string; senderName: string; category: string; matchId: string } | null) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
    const context = useContext(AppContext);
    if (context === undefined) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};
