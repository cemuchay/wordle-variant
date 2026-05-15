/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabaseClient';

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
            console.warn('Presence: Could not update last_seen_at', err);
        }
    }, [userId]);

    useEffect(() => {
        fetchProfiles();
        updateLastSeen();

        const heartbeat = setInterval(updateLastSeen, 2 * 60 * 1000);
        if (!userId) return () => clearInterval(heartbeat);

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

        channel
            .on('presence', { event: 'sync' }, syncPresence)
            .on('presence', { event: 'join' }, syncPresence)
            .on('presence', { event: 'leave' }, syncPresence)
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
            channel.unsubscribe();
            updateLastSeen();
        };
    }, [userId, fetchProfiles, updateLastSeen, currentVoiceRoomId]);

    // Update tracking when voice room changes
    useEffect(() => {
        if (channelRef.current && userId && channelRef.current.state === 'joined') {
            const { data: profile } = allProfiles.find(p => p.id === userId) 
                ? { data: allProfiles.find(p => p.id === userId) } 
                : { data: null };
            
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
