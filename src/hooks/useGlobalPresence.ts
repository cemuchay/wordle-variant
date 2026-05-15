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
                    const latest = sessions[0]; // Just take the latest session info
                    if (latest && latest.user) {
                        online.set(latest.user.id, latest.user);
                    }
                });

                setOnlineUsers(Array.from(online.values()));
            })
            .subscribe(async (status) => {
                if (status === 'SUBSCRIBED') {
                    // Fetch user info for presence
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

        return () => {
            clearInterval(heartbeat);
            channel.unsubscribe();
            updateLastSeen(); // Final update on leave
        };
    }, [userId, fetchProfiles, updateLastSeen]);

    return { onlineUsers, allProfiles, refreshProfiles: fetchProfiles };
};
