/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';
import { useQueryClient } from '@tanstack/react-query';

export interface PresenceUser {
    id: string;
    username: string;
    avatar_url: string;
    last_seen_at?: string;
    activeVoiceRoomId?: string | null;
}

export const useGlobalPresence = (userId: string | undefined, currentVoiceRoomId: string | null = null) => {
    const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
    const [allProfiles, setAllProfiles] = useState<PresenceUser[]>([]);
    const channelRef = useRef<any>(null);
    const queryClient = useQueryClient();

    const fetchProfiles = useCallback(async () => {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const { data } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, last_seen_at')
            .gte('last_seen_at', thirtyDaysAgo.toISOString())
            .order('username');
        if (data) {
            setAllProfiles(data as PresenceUser[]);
            // Also invalidate global profile queries if they exist to keep entire app in sync
            queryClient.invalidateQueries({ queryKey: ['profile'] });
        }
    }, [queryClient]);

    const updateLastSeen = useCallback(async () => {
        if (!userId) return;
        try {
            await supabase
                .from('profiles')
                .update({ last_seen_at: new Date().toISOString() })
                .eq('id', userId);
        } catch (err) {
            console.warn('Presence: Could not update last_seen_at', err);
        }
    }, [userId]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchProfiles();

        if (!userId) {
            setOnlineUsers([]);
            return;
        }

        updateLastSeen();
        const heartbeat = setInterval(updateLastSeen, 2 * 60 * 1000);

        const channelId = 'global_presence';
        const channel = supabase.channel(channelId, {
            config: { presence: { key: userId } }
        });

        const syncPresence = () => {
            const state = channel.presenceState();
            const online = new Map<string, PresenceUser>();

            Object.keys(state).forEach((key) => {
                const sessions = state[key] as any[];
                const latest = sessions[0]; 
                if (latest && latest.user) {
                    online.set(latest.user.id, {
                        ...latest.user,
                        activeVoiceRoomId: latest.activeVoiceRoomId
                    });
                }
            });

            setOnlineUsers(Array.from(online.values()));
        };

        const handleLeave = () => {
            syncPresence();
            // Fresh fetch of profiles to get the absolute latest last_seen_at from DB
            fetchProfiles();
        };

        channel
            .on('presence', { event: 'sync' }, syncPresence)
            .on('presence', { event: 'join' }, syncPresence)
            .on('presence', { event: 'leave' }, handleLeave)
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
                            online_at: new Date().toISOString(),
                            activeVoiceRoomId: currentVoiceRoomId
                        });
                    }
                }
            });

        channelRef.current = channel;

        return () => {
            clearInterval(heartbeat);
            supabase.removeChannel(channel);
            channelRef.current = null;
            updateLastSeen();
        };
    }, [userId, fetchProfiles, updateLastSeen]); // Removed currentVoiceRoomId - handled by the separate tracking effect below

        // Update tracking when voice room changes
    useEffect(() => {
        if (channelRef.current && userId && channelRef.current.state === 'joined') {
            const profile = allProfiles.find(p => p.id === userId);
            
            if (profile) {
                channelRef.current.track({
                    user: profile,
                    online_at: new Date().toISOString(),
                    activeVoiceRoomId: currentVoiceRoomId
                });
            }
        }
    }, [currentVoiceRoomId, userId, allProfiles]);

    return { onlineUsers, allProfiles, refreshProfiles: fetchProfiles };
};
