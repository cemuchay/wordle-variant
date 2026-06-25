/* eslint-disable @typescript-eslint/no-explicit-any */

import { createContext, useContext, useEffect, useState, type ReactNode, useMemo, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useGlobalPresence, type PresenceUser } from '../hooks/useGlobalPresence';
import { useAudioChat, type AudioChatState } from '../hooks/useAudioChat';
import { useAppStore, type VoiceCallState } from '../store/useAppStore';
import { useWordUpStore } from '../store/useWordUpStore';
import { useAuthoritativeDate, useProfile, useChallengeStatus } from '../hooks/queries/useServerData';
import { useAppInit } from '../hooks/useAppInit';
import { useQueryClient } from '@tanstack/react-query';
import { syncWithRetry } from '../lib/game-logic';
import { safeLocalStorage } from '../utils/storage';
import { logger } from '../lib/logger';

interface AppContextType {
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
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<any>(null);
    const [incomingWordUpInvite, setIncomingWordUpInvite] = useState<{ senderId: string; senderName: string; category: string } | null>(null);
    const queryClient = useQueryClient();

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => setUser(session?.user ?? null));
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
        return () => subscription.unsubscribe();
    }, []);

    const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'disconnected'>('connected');
    const wasDisconnectedRef = useRef(false);
    const lastHiddenTimeRef = useRef<number>(Date.now());
    const lastSyncRef = useRef<number>(0);

    useEffect(() => {
        // Monitor socket connection status via a shared real-time channel
        const channel = supabase
            .channel('connection_health_monitor')
            .subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    setRealtimeStatus('connected');
                } else {
                    setRealtimeStatus('disconnected');
                    wasDisconnectedRef.current = true;
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
    const isChatConversationOpen = useAppStore(s => s.isChatConversationOpen);
    const setIsChatOpen = useAppStore(s => s.setChatOpen);
    const setIsLoadingDate = useAppStore(s => s.setIsLoadingDate);
    const myParticipations = useAppStore(s => s.myParticipations);
    const setMyParticipations = useAppStore(s => s.setMyParticipations);

    const globalMessages = useAppStore(s => s.globalMessages);
    const readReceipts = useAppStore(s => s.readReceipts);
    const joinedGroupIds = useAppStore(s => s.joinedGroupIds);

    // Centralized reactive unread chat messages calculator
    useEffect(() => {
        if (!user?.id) {
            setUnreadCount(0);
            return;
        }

        let isCancelled = false;

        const calculateUnread = async () => {
            let hasPlayed = false;
            const cached = queryClient.getQueryData(['server-date']) as any;
            const gameDate = cached?.formatted || null;
            if (gameDate) {
                const { data } = await supabase
                    .from("scores")
                    .select("status")
                    .eq("user_id", user.id)
                    .eq("game_date", gameDate)
                    .in("status", ["won", "lost"])
                    .maybeSingle();
                hasPlayed = !!data;
            }

            if (isCancelled) return;

            const joinedSet = new Set(joinedGroupIds);
            const count = globalMessages.filter((m) => {
                if (m.user_id === user.id) return false;
                if (!joinedSet.has(m.group_id)) return false;
                // Game Analysis is locked if user hasn't played today
                if (!hasPlayed && m.group_id === "00000000-0000-0000-0000-000000000002") return false;
                const lastSeen = readReceipts[m.group_id] || new Date(0).toISOString();
                return new Date(m.created_at).getTime() > new Date(lastSeen).getTime();
            }).length;

            setUnreadCount(count);
        };

        calculateUnread();

        return () => {
            isCancelled = true;
        };
    }, [globalMessages, readReceipts, joinedGroupIds, user?.id, setUnreadCount, queryClient]);

    // Refs for signaling
    const signalingChannelRef = useRef<any>(null);
    const oneShotChannelsRef = useRef<Set<any>>(new Set());

    const trackOneShotChannel = useCallback((channel: any, timeoutMs = 1000) => {
        oneShotChannelsRef.current.add(channel);
        setTimeout(() => {
            if (oneShotChannelsRef.current.has(channel)) {
                supabase.removeChannel(channel);
                oneShotChannelsRef.current.delete(channel);
            }
        }, timeoutMs);
    }, []);

    // Clean up any lingering one-shot channels on unmount
    useEffect(() => {
        return () => {
            oneShotChannelsRef.current.forEach(ch => supabase.removeChannel(ch));
            // eslint-disable-next-line react-hooks/exhaustive-deps
            oneShotChannelsRef.current.clear();
        };
    }, []);

    // 3. Server-Side State (TanStack Query)
    const { data: serverDateResponse, isLoading: isLoadingDate } = useAuthoritativeDate();
    const { data: profile, isLoading: isProfileLoading } = useProfile(user?.id);
    const { data: challengeStatus } = useChallengeStatus(user?.id);

    const refreshProfile = useCallback(async () => {
        if (user?.id) {
            await queryClient.invalidateQueries({ queryKey: ['profile', user.id] });
        }
    }, [user?.id, queryClient]);

    // 4. Presence
    const { onlineUsers, allProfiles } = useGlobalPresence(
        user?.id,
        (activeCall && (activeCall.status === 'connecting' || activeCall.status === 'connected')) ? activeCall.channelId : null,
        profile
    );

    // Call Signaling Actions
    const acceptCall = useCallback(() => {
        const currentCall = useAppStore.getState().activeCall;
        if (!currentCall || currentCall.role !== 'receiver' || !user?.id) return;

        const targetChannel = supabase.channel(`user_signals_${currentCall.targetUser?.id}`);
        trackOneShotChannel(targetChannel);
        targetChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                targetChannel.send({
                    type: 'broadcast',
                    event: 'call_accepted',
                    payload: { channelId: currentCall.channelId }
                });
            }
        });

        setActiveCall({
            ...currentCall,
            status: 'connecting'
        });
    }, [user?.id, setActiveCall, trackOneShotChannel]);

    const rejectCall = useCallback(() => {
        const currentCall = useAppStore.getState().activeCall;
        if (!currentCall || currentCall.role !== 'receiver' || !user?.id) return;

        const targetChannel = supabase.channel(`user_signals_${currentCall.targetUser?.id}`);
        trackOneShotChannel(targetChannel);
        targetChannel.subscribe((status) => {
            if (status === 'SUBSCRIBED') {
                targetChannel.send({
                    type: 'broadcast',
                    event: 'call_rejected',
                    payload: { channelId: currentCall.channelId }
                });
            }
        });

        setActiveCall(null);
    }, [user?.id, setActiveCall, trackOneShotChannel]);

    const hangUpCall = useCallback(() => {
        const currentCall = useAppStore.getState().activeCall;
        if (!currentCall || !user?.id) return;

        if (currentCall.type === 'private' && currentCall.targetUser) {
            const targetChannel = supabase.channel(`user_signals_${currentCall.targetUser.id}`);
            trackOneShotChannel(targetChannel);
            targetChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    targetChannel.send({
                        type: 'broadcast',
                        event: 'hang_up',
                        payload: { channelId: currentCall.channelId }
                    });
                }
            });
        }

        setActiveCall(null);
    }, [user?.id, setActiveCall, trackOneShotChannel]);

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
        trackOneShotChannel(targetChannel);
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
            }
        });

        // 25 seconds ring timeout
        const timeoutId = setTimeout(() => {
            const currentCall = useAppStore.getState().activeCall;
            if (currentCall && currentCall.channelId === channelId && currentCall.status === 'calling') {
                triggerToast('No answer.', 4000);
                const hangupChannel = supabase.channel(`user_signals_${targetUser.id}`);
                trackOneShotChannel(hangupChannel);
                hangupChannel.subscribe((status) => {
                    if (status === 'SUBSCRIBED') {
                        hangupChannel.send({
                            type: 'broadcast',
                            event: 'hang_up',
                            payload: { channelId }
                        });
                    }
                });
                setActiveCall(null);
            }
        }, 25000);

        return () => clearTimeout(timeoutId);
    }, [user, profile, triggerToast, setActiveCall, trackOneShotChannel]);

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
                        trackOneShotChannel(groupChannel);
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
                    trackOneShotChannel(busyChannel);
                    busyChannel.subscribe((status) => {
                        if (status === 'SUBSCRIBED') {
                            busyChannel.send({
                                type: 'broadcast',
                                event: 'call_busy',
                                payload: { channelId: payload.channelId }
                            });
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
            .on('broadcast', { event: 'wordup_invite' }, ({ payload }) => {
                // If invitee is already in a match or call, send busy back
                const currentCall = useAppStore.getState().activeCall;
                const activeMatchId = useWordUpStore.getState().matchId;
                if ((currentCall && currentCall.status !== 'idle') || activeMatchId) {
                    const busyChannel = supabase.channel(`user_signals_${payload.senderId}`);
                    trackOneShotChannel(busyChannel);
                    busyChannel.subscribe((status) => {
                        if (status === 'SUBSCRIBED') {
                            busyChannel.send({
                                type: 'broadcast',
                                event: 'wordup_invite_busy',
                                payload: { senderId: payload.senderId }
                            });
                        }
                    });
                    return;
                }
                setIncomingWordUpInvite(payload);
            })
            .on('broadcast', { event: 'wordup_invite_rejected' }, ({ payload }) => {
                window.dispatchEvent(new CustomEvent('wordup-invite-rejected', { detail: payload }));
            })
            .on('broadcast', { event: 'wordup_invite_busy' }, ({ payload }) => {
                window.dispatchEvent(new CustomEvent('wordup-invite-busy', { detail: payload }));
            })
            .on('broadcast', { event: 'wordup_invite_accepted' }, ({ payload }) => {
                window.dispatchEvent(new CustomEvent('wordup-invite-accepted', { detail: payload }));
            })
            .on('broadcast', { event: 'wordup_invite_later' }, ({ payload }) => {
                window.dispatchEvent(new CustomEvent('wordup-invite-later', { detail: payload }));
            })
            .subscribe();

        signalingChannelRef.current = channel;

        return () => {
            supabase.removeChannel(channel);
            signalingChannelRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
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
            supabase.removeChannel(channel);
        };
    }, [user?.id, myParticipations, triggerToast]);

    // 6. Computed State
    const activeVoiceRooms = useMemo(() => {
        return onlineUsers
            .filter(u => u.id !== user?.id && u.activeVoiceRoomId && (u.activeVoiceRoomId === 'global' || myParticipations.includes(u.activeVoiceRoomId)))
            .map(u => ({ challengeId: u.activeVoiceRoomId!, user: u }));
    }, [onlineUsers, user?.id, myParticipations]);

    // Global chat background sync: messages and read receipts pre-fetching + real-time subscription
    useEffect(() => {
        if (!user?.id) return;

        const fetchMessagesAndReceipts = async () => {
            const { data: receiptData } = await supabase
                .from('chat_read_receipts')
                .select('group_id, last_seen_at')
                .eq('user_id', user.id);

            const receipts: Record<string, string> = {};
            if (receiptData) {
                receiptData.forEach(r => {
                    receipts[r.group_id] = r.last_seen_at;
                });
            }
            useAppStore.getState().setReadReceipts(receipts);

            // Fetch the user's joined groups
            const { data: memberData } = await supabase
                .from('chat_group_members')
                .select('group_id')
                .eq('user_id', user.id)
                .eq('status', 'joined');

            const joinedSet = new Set<string>();
            joinedSet.add("00000000-0000-0000-0000-000000000001");
            joinedSet.add("00000000-0000-0000-0000-000000000002");
            joinedSet.add("00000000-0000-0000-0000-000000000003");
            if (memberData) {
                memberData.forEach(m => joinedSet.add(m.group_id));
            }
            const joinedArray = Array.from(joinedSet);
            useAppStore.getState().setJoinedGroupIds(joinedArray);

            const { data } = await supabase
                .from('messages')
                .select('*, profiles(username, avatar_url)')
                .order('created_at', { ascending: false })
                .limit(300);

            if (data) {
                const chronData = data.reverse();
                useAppStore.getState().setGlobalMessages(chronData);
            }
        };

        const syncMessages = async () => {
            if (!user?.id) return;

            // Throttle syncs to once every 10 seconds to avoid spamming
            const now = Date.now();
            if (now - lastSyncRef.current < 10000) return;
            lastSyncRef.current = now;

            // 1. Force refresh notification query
            queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
            
            const currentMessages = useAppStore.getState().globalMessages;
            if (currentMessages.length === 0) {
                fetchMessagesAndReceipts();
                return;
            }

            const lastMessage = currentMessages[currentMessages.length - 1];
            const lastCreatedAt = lastMessage?.created_at;

            if (!lastCreatedAt) return;

            // Fetch only messages created after our last known message
            const { data, error } = await supabase
                .from('messages')
                .select('*, profiles(username, avatar_url)')
                .gt('created_at', lastCreatedAt)
                .order('created_at', { ascending: true });

            if (!error && data && data.length > 0) {
                data.forEach(msg => {
                    useAppStore.getState().addGlobalMessage(msg);
                });
            }
        };

        fetchMessagesAndReceipts();

        // Re-sync messages when app comes back to foreground or connection is restored
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible') {
                syncMessages();
                
                const timeHidden = Date.now() - lastHiddenTimeRef.current;
                const shouldRefresh = wasDisconnectedRef.current || timeHidden > 30 * 60 * 1000;

                if (shouldRefresh) {
                    // Refresh authoritative date silently and trigger a global event for game engines to re-hydrate
                    queryClient.refetchQueries({ queryKey: ['server-date'], type: 'active' });
                    window.dispatchEvent(new CustomEvent('app-visibility-visible'));
                    wasDisconnectedRef.current = false;
                }
            } else {
                lastHiddenTimeRef.current = Date.now();
            }
        };

        const handleOnline = () => {
            syncMessages();
            queryClient.refetchQueries({ queryKey: ['server-date'], type: 'active' });
            window.dispatchEvent(new CustomEvent('app-visibility-visible'));
            wasDisconnectedRef.current = false;
        };

        window.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('online', handleOnline);

        const channel = supabase
            .channel('global_chat_channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'messages' },
                async (payload) => {

                    // 1. Extract the group ID
                    //@ts-expect-error `supabase new does not have group_id defined`
                    const groupId = payload.new?.group_id || payload.old?.group_id;

                    // 2. Check if the user is a member of the group
                    const joinedIds = useAppStore.getState().joinedGroupIds;
                    const belongsToUser = joinedIds.includes(groupId);

                    // 3. Early return if this is an entirely unrelated group
                    if (!belongsToUser) return;

                    if (payload.eventType === 'INSERT') {
                        const newMessage = payload.new as any;
                        let profile;

                        const allMsgs = useAppStore.getState().globalMessages;
                        const existingMsg = allMsgs.find(m => m.user_id === newMessage.user_id && m.profiles);

                        if (existingMsg) {
                            profile = existingMsg.profiles;
                        } else {
                            const { data: fetchedProfile } = await supabase
                                .from('profiles')
                                .select('id, username, avatar_url')
                                .eq('id', newMessage.user_id)
                                .single();
                            profile = fetchedProfile;
                        }

                        const messageWithProfile = { ...newMessage, profiles: profile };
                        useAppStore.getState().addGlobalMessage(messageWithProfile);
                    } else if (payload.eventType === 'UPDATE') {
                        // Merge the updated columns in global store
                        useAppStore.getState().updateGlobalMessage(payload.new);
                    } else if (payload.eventType === 'DELETE') {
                        // Remove deleted records (e.g. from 24h cron purges)
                        useAppStore.setState((state) => ({
                            globalMessages: state.globalMessages.filter((m) => m.id !== payload.old.id)
                        }));
                    }
                }
            )
            .subscribe();

        const receiptsChannel = supabase
            .channel('chat_read_receipts_channel')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'chat_read_receipts', filter: `user_id=eq.${user.id}` },
                async (payload) => {
                    if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
                        const newReceipt = payload.new as any;
                        useAppStore.getState().updateReadReceipt(newReceipt.group_id, newReceipt.last_seen_at);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
            supabase.removeChannel(receiptsChannel);
            window.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('focus', handleOnline);
        };
    }, [user?.id]);

    // Background sync for pending game states when connectivity is restored
    useEffect(() => {
        const syncPendingGames = async (userId: string) => {
            const keys = safeLocalStorage.getAllKeys();
            for (const key of keys) {
                if (!key.startsWith('wordle-')) continue;
                const date = key.replace('wordle-', '');
                if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;

                try {
                    const raw = safeLocalStorage.getItem(key);
                    if (!raw) continue;
                    const payload = JSON.parse(raw);
                    if (!payload.needsSync || !payload.guesses?.length) continue;

                    const result = await syncWithRetry(userId, date, payload);
                    if (result.success) {
                        delete payload.needsSync;
                        safeLocalStorage.setItem(key, JSON.stringify(payload));
                        logger.info(`Background sync successful for ${date}`);
                    }
                } catch (e) {
                    logger.warn(`Background sync failed for ${key}`, { error: e });
                }
            }
        };

        const handleOnline = () => {
            if (user?.id) syncPendingGames(user.id);
        };

        window.addEventListener('online', handleOnline);

        // Also retry pending syncs on visibility change (app coming to foreground)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && user?.id) {
                syncPendingGames(user.id);
            }
        };
        window.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, [user?.id]);

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
        refreshProfile,
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
        isChatConversationOpen,
        setIsChatOpen,
        onlineUsers,
        allProfiles,
        audioChat,
        activeVoiceRooms,
        initiatePrivateCall,
        acceptCall,
        rejectCall,
        hangUpCall,
        realtimeStatus,
        isDynamicIslandVisible: true,
        incomingWordUpInvite,
        setIncomingWordUpInvite
    }), [
        profile, preferences, isProfileLoading, refreshProfile, toast, triggerToast,
        setToast, unreadCount, setUnreadCount, challengeUnreadCount,
        setChallengeUnreadCount, serverDateResponse?.formatted, isLoadingDate,
        setIsLoadingDate, stats, setStats, activeCall,
        setActiveCall, isChallengeOpen, setIsChallengeOpen,
        isNotificationsOpen, setIsNotificationsOpen,
        isChatOpen,
        isChatConversationOpen,
        setIsChatOpen,
        onlineUsers,
        allProfiles,
        audioChat, activeVoiceRooms, initiatePrivateCall,
        acceptCall, rejectCall, hangUpCall, realtimeStatus,
        incomingWordUpInvite, setIncomingWordUpInvite
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
