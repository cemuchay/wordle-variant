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

export const useGlobalPresence = (userId: string | undefined, currentVoiceRoomId: string | null = null, currentUserProfile: any = null) => {
    const [onlineUsers, setOnlineUsers] = useState<PresenceUser[]>([]);
    const [allProfiles, setAllProfiles] = useState<PresenceUser[]>([]);
    const channelRef = useRef<any>(null);
    const queryClient = useQueryClient();

    const fetchProfiles = useCallback(async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, username, avatar_url, last_seen_at')
            .order('last_seen_at', { ascending: false, nullsFirst: false })
            .limit(100);
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
                    let profileToTrack = currentUserProfile;

                    if (!profileToTrack) {
                        const { data: profile } = await supabase
                            .from('profiles')
                            .select('id, username, avatar_url')
                            .eq('id', userId)
                            .single();
                        profileToTrack = profile;
                    }

                    if (profileToTrack) {
                        channel.track({
                            user: {
                                id: profileToTrack.id,
                                username: profileToTrack.username,
                                avatar_url: profileToTrack.avatar_url,
                            },
                            online_at: new Date().toISOString(),
                            activeVoiceRoomId: currentVoiceRoomId
                        }).catch(console.warn);
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
    }, [userId, fetchProfiles, updateLastSeen]); // Removed currentVoiceRoomId and currentUserProfile to avoid recreating channel

        // Update tracking when voice room changes or currentUserProfile updates
    useEffect(() => {
        if (channelRef.current && userId && currentUserProfile) {
            // Track silently, ignore errors if not fully subscribed yet
            channelRef.current.track({
                user: {
                    id: currentUserProfile.id,
                    username: currentUserProfile.username,
                    avatar_url: currentUserProfile.avatar_url,
                },
                online_at: new Date().toISOString(),
                activeVoiceRoomId: currentVoiceRoomId
            }).catch(() => {});
        }
    }, [currentVoiceRoomId, userId, currentUserProfile]);

    const mergedProfiles = Array.from(new Map([...allProfiles, ...onlineUsers].map(p => [p.id, p])).values());

    return { onlineUsers, allProfiles: mergedProfiles, refreshProfiles: fetchProfiles };
};
