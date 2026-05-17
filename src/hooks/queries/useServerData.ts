import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { getServerDate } from '../../lib/time';

/**
 * Hook to fetch the authoritative server date.
 * WHY: Prevents client-side clock manipulation.
 */
export const useAuthoritativeDate = () => {
    return useQuery({
        queryKey: ['server-date'],
        queryFn: getServerDate,
        staleTime: 1000 * 60 * 60, // Consider date fresh for 1 hour
    });
};

/**
 * Hook to fetch and sync the user's profile.
 * Handles the "Auth State" as a server-side dependency.
 */
export const useProfile = (userId: string | undefined) => {
    return useQuery({
        queryKey: ['profile', userId],
        queryFn: async () => {
            if (!userId) return null;
            const { data, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', userId)
                .single();
            if (error) throw error;
            return data;
        },
        enabled: !!userId,
    });
};

/**
 * Hook to fetch challenge unread counts.
 */
export const useChallengeStatus = (userId: string | undefined) => {
    return useQuery({
        queryKey: ['challenge-unread', userId],
        queryFn: async () => {
            if (!userId) return { unreadCount: 0, participations: [] };
            
            const { data, error } = await supabase
                .from('challenge_participants')
                .select('challenge_id, status, challenge:challenges(expires_at)')
                .eq('user_id', userId);

            if (error) throw error;

            const unread = data.filter((c: any) =>
                (c.status === 'pending' || c.status === 'playing') &&
                new Date(c.challenge.expires_at) > new Date()
            ).length;

            return {
                unreadCount: unread,
                participations: data.map(p => p.challenge_id)
            };
        },
        enabled: !!userId,
    });
};
