/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

export interface PresenceUser {
    id: string;
    username: string;
    avatar_url: string;
    last_seen_at?: string;
}

export const useGlobalPresence = (userId: string | undefined) => {
    const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
    const [allProfiles, setAllProfiles] = useState<PresenceUser[]>([]);
    const [incomingCall, setIncomingCall] = useState<{ from: PresenceUser, challengeId: string } | null>(null);
    const channelRef = useRef<any>(null);
    const signalChannelRef = useRef<any>(null);

    const fetchProfiles = useCallback(async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, last_seen_at')
            .order('username');
        if (data) setAllProfiles(data as PresenceUser[]);
    }, []);

    const updateLastSeen = useCallback(async () => {
        if (!userId) return;
        try {
            await supabase
                .from('profiles')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', userId);
        } catch (err) {
            // Silently fail if column doesn't exist yet
            console.warn('Presence: Could not update last_seen_at', err);
        }
    }, [userId]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchProfiles();
        updateLastSeen();

        // Periodic heartbeat every 2 minutes
        const heartbeat = setInterval(updateLastSeen, 2 * 60 * 1000);

        if (!userId) return () => clearInterval(heartbeat);

        // 1. Presence Channel
        const channelId = 'global_presence';
        const channel = supabase.channel(channelId, {
            config: { presence: { key: userId } }
        });

        channel
            .on('presence', { event: 'sync' }, () => {
                const state = channel.presenceState();
                const online = new Map<string, PresenceUser>();

                Object.keys(state).forEach((key) => {
                    const sessions = state[key] as any[];
                    const latest = sessions[0]; 
                    if (latest && latest.user) {
                        online.set(latest.user.id, latest.user);
                    }
                });

                setOnlineUsers(Array.from(online.values()));
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('id, username, avatar_url')
                        .eq('id', userId)
                        .single();

                    if (profile) {
                        channel.track({
                            user: profile,
                            online_at: new Date().toISOString()
                        });
                    }
                }
            });

        channelRef.current = channel;

        // 2. Private Signal Channel (for Incoming Calls)
        const signalChannelId = `user_signals_${userId}`;
        const signalChannel = supabase.channel(signalChannelId);

        signalChannel
            .on('broadcast', { event: 'incoming_call' }, ({ payload }) => {
                setIncomingCall({ from: payload.from, challengeId: payload.challengeId });
            })
            .on('broadcast', { event: 'call_cancelled' }, () => {
                setIncomingCall(null);
            })
            .subscribe();

        signalChannelRef.current = signalChannel;

        return () => {
            clearInterval(heartbeat);
            channel.unsubscribe();
            signalChannel.unsubscribe();
            updateLastSeen();
        };
    }, [userId, fetchProfiles, updateLastSeen]);

    const sendIncomingCall = useCallback((challengeId: string) => {
        if (!userId || !allProfiles.length) return;
        const me = allProfiles.find(p => p.id === userId);
        if (!me) return;

        // Broadcast to all online users
        onlineUsers.forEach(u => {
            if (u.id === userId) return;
            const userChannel = supabase.channel(`user_signals_${u.id}`);
            userChannel.subscribe((status) => {
                if (status === 'SUBSCRIBED') {
                    userChannel.send({
                        type: 'broadcast',
                        event: 'incoming_call',
                        payload: { from: me, challengeId }
                    });
                    setTimeout(() => supabase.removeChannel(userChannel), 5000);
                }
            });
        });
    }, [userId, allProfiles, onlineUsers]);

    return { onlineUsers, allProfiles, incomingCall, setIncomingCall, refreshProfiles: fetchProfiles, sendIncomingCall };
};
