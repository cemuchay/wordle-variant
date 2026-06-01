/* eslint-disable @typescript-eslint/no-explicit-any */

import { createContext, useContext, useEffect, useState, type ReactNode, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useGlobalPresence, type PresenceUser } from '../hooks/useGlobalPresence';
import { useAudioChat, type AudioChatState } from '../hooks/useAudioChat';
import { useAppStore, type VoiceCallState } from '../store/useAppStore';
import { useAuthoritativeDate, useProfile, useChallengeStatus } from '../hooks/queries/useServerData';
import { useAppInit } from '../hooks/useAppInit';
import { safeLocalStorage } from '../utils/storage';

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
    activeCall: VoiceCallState | null;
    setActiveCall: (call: VoiceCallState | null) => void;
    isChallengeOpen: boolean;
    setIsChallengeOpen: (val: boolean) => void;
    isNotificationsOpen: boolean;
    setIsNotificationsOpen: (val: boolean) => void;
    isChatOpen: boolean;
    setIsChatOpen: (val: boolean) => void;

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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<any>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
        return () => subscription.unsubscribe();
    }, []);

    const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'disconnected'>('connected');

    useEffect(() => {
        // Monitor socket connection status via a shared real-time channel
        const channel = supabase
            .channel('connection_health_monitor')
            .subscribe((status) => {
                console.log('[Realtime Health] Channel status:', status);
                if (status === 'SUBSCRIBED') {
                    setRealtimeStatus('connected');
                } else {
                    setRealtimeStatus('disconnected');
                }
            });

        return () => {
            supabase.removeChannel(channel);
        };
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
    const isNotificationsOpen = useAppStore(s => s.isNotificationsOpen);
    const setIsNotificationsOpen = useAppStore(s => s.setNotificationsOpen);
    const isChatOpen = useAppStore(s => s.isChatOpen);
    const setIsChatOpen = useAppStore(s => s.setChatOpen);
    const setIsLoadingDate = useAppStore(s => s.setIsLoadingDate);
    const myParticipations = useAppStore(s => s.myParticipations);
    const setMyParticipations = useAppStore(s => s.setMyParticipations);

    // Refs for signaling
    const signalingChannelRef = useRef<any>(null);

    // 3. Server-Side State (TanStack Query)
    const { data: serverDateResponse, isLoading: isLoadingDate } = useAuthoritativeDate();
    const { data: profile, isLoading: isProfileLoading } = useProfile(user?.id);
    const { data: challengeStatus } = useChallengeStatus(user?.id);

    // 4. Presence
    const { onlineUsers, allProfiles } = useGlobalPresence(
        user?.id,
        (activeCall && (activeCall.status === 'connecting' || activeCall.status === 'connected')) ? activeCall.channelId : null
    );

    // Call Signaling Actions
    const acceptCall = useCallback(() => {
        const currentCall = useAppStore.getState().activeCall;
        if (!currentCall || currentCall.role !== 'receiver' || !user?.id) return;

        const targetChannel = supabase.channel(`user_signals_${currentCall.targetUser?.id}`);
        targetChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                targetChannel.send({
                    type: 'broadcast',
                    event: 'call_accepted',
                    payload: { channelId: currentCall.channelId }
                });
                setTimeout(() => targetChannel.unsubscribe(), 1000);
            }
        });

        setActiveCall({
            ...currentCall,
            status: 'connecting'
        });
    }, [user?.id, setActiveCall]);

    const rejectCall = useCallback(() => {
        const currentCall = useAppStore.getState().activeCall;
        if (!currentCall || currentCall.role !== 'receiver' || !user?.id) return;

        const targetChannel = supabase.channel(`user_signals_${currentCall.targetUser?.id}`);
        targetChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                targetChannel.send({
                    type: 'broadcast',
                    event: 'call_rejected',
                    payload: { channelId: currentCall.channelId }
                });
                setTimeout(() => targetChannel.unsubscribe(), 1000);
            }
        });

        setActiveCall(null);
    }, [user?.id, setActiveCall]);

    const hangUpCall = useCallback(() => {
        const currentCall = useAppStore.getState().activeCall;
        if (!currentCall || !user?.id) return;

        if (currentCall.type === 'private' && currentCall.targetUser) {
            const targetChannel = supabase.channel(`user_signals_${currentCall.targetUser.id}`);
            targetChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    targetChannel.send({
                        type: 'broadcast',
                        event: 'hang_up',
                        payload: { channelId: currentCall.channelId }
                    });
                    setTimeout(() => targetChannel.unsubscribe(), 1000);
                }
            });
        }

        setActiveCall(null);
    }, [user?.id, setActiveCall]);

    const initiatePrivateCall = useCallback((targetUser: { id: string; username: string; avatar_url: string }) => {
        if (!user?.id) return;
        const minId = user.id < targetUser.id ? user.id : targetUser.id;
        const maxId = user.id > targetUser.id ? user.id : targetUser.id;
        const cleanMin = minId.replace(/-/g, '');
        const cleanMax = maxId.replace(/-/g, '');
        const channelId = `call_${cleanMin.slice(0, 16)}_${cleanMax.slice(0, 16)}`;


        const callState: VoiceCallState = {
            channelId,
            type: 'private',
            role: 'caller',
            targetUser,
            status: 'calling'
        };

        setActiveCall(callState);

        const targetChannel = supabase.channel(`user_signals_${targetUser.id}`);
        targetChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                targetChannel.send({
                    type: 'broadcast',
                    event: 'incoming_call',
                    payload: {
                        channelId,
                        callerId: user.id,
                        callerName: profile?.username || 'Someone',
                        callerAvatar: profile?.avatar_url || ''
                    }
                });
                setTimeout(() => targetChannel.unsubscribe(), 1000);
            }
        });

        // 25 seconds ring timeout
        const timeoutId = setTimeout(() => {
            const currentCall = useAppStore.getState().activeCall;
            if (currentCall && currentCall.channelId === channelId && currentCall.status === 'calling') {
                triggerToast('No answer.', 4000);
                const hangupChannel = supabase.channel(`user_signals_${targetUser.id}`);
                hangupChannel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        hangupChannel.send({
                            type: 'broadcast',
                            event: 'hang_up',
                            payload: { channelId }
                        });
                        setTimeout(() => hangupChannel.unsubscribe(), 1000);
                    }
                });
                setActiveCall(null);
            }
        }, 25000);

        return () => clearTimeout(timeoutId);
    }, [user, profile, triggerToast, setActiveCall]);

    // 5. Audio logic integration
    const audioChat = useAudioChat({
        activeCall,
        userId: user?.id || '',
        enabled: !!activeCall && (activeCall.status === 'connecting' || activeCall.status === 'connected'),
        onConnectionFailure: (reason) => {
            triggerToast(`Call failed: ${reason}`, 5000);
            hangUpCall();
        },
        onConnectionSuccess: () => {
            const currentCall = useAppStore.getState().activeCall;
            if (currentCall) {
                setActiveCall({
                    ...currentCall,
                    status: 'connected'
                });

                // Group call alert handling
                if (currentCall.type === 'group') {
                    const activeInRoom = onlineUsers.filter(u => u.activeVoiceRoomId === currentCall.channelId);
                    if (activeInRoom.length <= 1) {
                        const groupChannel = supabase.channel('group_call_signals');
                        groupChannel.subscribe((status) => {
                            if (status === 'SUBSCRIBED') {
                                groupChannel.send({
                                    type: 'broadcast',
                                    event: 'group_call_alert',
                                    payload: {
                                        creatorId: user.id,
                                        creatorName: profile?.username || 'Someone',
                                        roomName: currentCall.channelId === 'global' ? 'General Chat' : 'Challenge Lobby',
                                        challengeId: currentCall.channelId
                                    }
                                });
                                setTimeout(() => groupChannel.unsubscribe(), 1000);
                            }
                        });
                    }
                }
            }
        }
    });

    // Subscriptions for signaling
    useEffect(() => {
        if (!user?.id) return;
        const channel = supabase.channel(`user_signals_${user.id}`);

        channel
            .on('broadcast', { event: 'incoming_call' }, ({ payload }) => {
                const currentCall = useAppStore.getState().activeCall;
                if (currentCall && currentCall.status !== 'idle') {
                    // Send call_busy to caller
                    const busyChannel = supabase.channel(`user_signals_${payload.callerId}`);
                    busyChannel.subscribe((status) => {
                        if (status === 'SUBSCRIBED') {
                            busyChannel.send({
                                type: 'broadcast',
                                event: 'call_busy',
                                payload: { channelId: payload.channelId }
                            });
                            setTimeout(() => busyChannel.unsubscribe(), 1000);
                        }
                    });
                    return;
                }

                setActiveCall({
                    channelId: payload.channelId,
                    type: 'private',
                    role: 'receiver',
                    targetUser: { id: payload.callerId, username: payload.callerName, avatar_url: payload.callerAvatar },
                    status: 'ringing'
                });
            })
            .on('broadcast', { event: 'call_accepted' }, ({ payload }) => {
                const currentCall = useAppStore.getState().activeCall;
                if (currentCall && currentCall.channelId === payload.channelId && currentCall.status === 'calling') {
                    setActiveCall({
                        ...currentCall,
                        status: 'connecting'
                    });
                }
            })
            .on('broadcast', { event: 'call_rejected' }, ({ payload }) => {
                const currentCall = useAppStore.getState().activeCall;
                if (currentCall && currentCall.channelId === payload.channelId) {
                    triggerToast(`${currentCall.targetUser?.username || 'Opponent'} rejected the call.`, 4000);
                    setActiveCall(null);
                }
            })
            .on('broadcast', { event: 'call_busy' }, ({ payload }) => {
                const currentCall = useAppStore.getState().activeCall;
                if (currentCall && currentCall.channelId === payload.channelId) {
                    triggerToast(`${currentCall.targetUser?.username || 'Opponent'} is busy.`, 4000);
                    setActiveCall(null);
                }
            })
            .on('broadcast', { event: 'hang_up' }, ({ payload }) => {
                const currentCall = useAppStore.getState().activeCall;
                if (currentCall && currentCall.channelId === payload.channelId) {
                    triggerToast(`Call ended.`, 3000);
                    setActiveCall(null);
                }
            })
            .subscribe();

        signalingChannelRef.current = channel;

        return () => {
            channel.unsubscribe();
            signalingChannelRef.current = null;
        };
    }, [user?.id, triggerToast, setActiveCall]);

    // Subscriptions for group call alerts
    useEffect(() => {
        if (!user?.id) return;
        const channel = supabase.channel('group_call_signals');

        channel
            .on('broadcast', { event: 'group_call_alert' }, ({ payload }) => {
                if (payload.creatorId === user.id) return;

                let eligible = false;
                if (payload.challengeId === 'global') {
                    eligible = true;
                } else if (myParticipations.includes(payload.challengeId)) {
                    eligible = true;
                }

                if (eligible) {
                    triggerToast(`${payload.creatorName} created a call in ${payload.roomName}! Join Voice to connect.`, 6000);
                }
            })
            .subscribe();

        return () => {
            channel.unsubscribe();
        };
    }, [user?.id, myParticipations, triggerToast]);

    // 6. Computed State
    const activeVoiceRooms = useMemo(() => {
        return onlineUsers
            .filter(u => u.id !== user?.id && u.activeVoiceRoomId && (u.activeVoiceRoomId === 'global' || myParticipations.includes(u.activeVoiceRoomId)))
            .map(u => ({ challengeId: u.activeVoiceRoomId!, user: u }));
    }, [onlineUsers, user?.id, myParticipations]);

    // Global chat background sync: messages pre-fetching and real-time subscription
    useEffect(() => {
        if (!user?.id) return;

        const fetchMessages = async () => {
            const { data } = await supabase
                .from('messages')
                .select('*, profiles(username, avatar_url)')
                .order('created_at', { ascending: true });
            
            if (data) {
                useAppStore.getState().setGlobalMessages(data);
                const lastSeen = safeLocalStorage.getItem(`lastSeen_${user.id}`) || new Date(0).toISOString();
                const unreads = data.filter(
                    (m) => m.user_id !== user.id && m.created_at > lastSeen
                );
                setUnreadCount(unreads.length);
            }
        };

        fetchMessages();

        const channel = supabase
            .channel('global_chat_channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'messages' },
                async (payload) => {
                    if (payload.eventType === 'INSERT') {
                        const newMessage = payload.new as any;
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('id, username, avatar_url')
                            .eq('id', newMessage.user_id)
                            .single();
                        
                        const messageWithProfile = { ...newMessage, profiles: profile };
                        useAppStore.getState().addGlobalMessage(messageWithProfile);

                        const currentIsChatOpen = useAppStore.getState().isChatOpen;
                        if (newMessage.user_id !== user.id && !currentIsChatOpen) {
                            setUnreadCount(useAppStore.getState().unreadCount + 1);
                        }
                    } else if (payload.eventType === 'UPDATE') {
                        useAppStore.getState().updateGlobalMessage(payload.new);
                    }
                }
            )
            .subscribe();

        return () => {
            channel.unsubscribe();
            supabase.removeChannel(channel);
        };
    }, [user?.id, setUnreadCount]);

    // Sync Query data with Store (Bridge)
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

    // Context Bridge
    const contextValue: AppContextType = useMemo(() => ({
        profile,
        preferences,
        loading: isProfileLoading,
        refreshProfile: async () => {},
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
        isNotificationsOpen,
        setIsNotificationsOpen,
        isChatOpen,
        setIsChatOpen,
        onlineUsers,
        allProfiles,
        audioChat,
        activeVoiceRooms,
        initiatePrivateCall,
        acceptCall,
        rejectCall,
        hangUpCall,
        realtimeStatus
    }), [
        profile, preferences, isProfileLoading, toast, triggerToast,
        setToast, unreadCount, setUnreadCount, challengeUnreadCount,
        setChallengeUnreadCount, serverDateResponse?.formatted, isLoadingDate,
        setIsLoadingDate, stats, setStats, activeCall,
        setActiveCall, isChallengeOpen, setIsChallengeOpen,
        isNotificationsOpen, setIsNotificationsOpen,
        isChatOpen, setIsChatOpen, onlineUsers, allProfiles,
        audioChat, activeVoiceRooms, initiatePrivateCall,
        acceptCall, rejectCall, hangUpCall, realtimeStatus
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
