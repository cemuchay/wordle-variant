/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { AppUser } from '../types/game';

export interface Challenge {
    profiles: any;
    id: string;
    creator_id: string;
    mode: 'LIVE' | 'ANYTIME';
    word_length: number;
    target_word: string;
    salt: string;
    max_time: number | null;
    expires_at: string;
    created_at: string;
    creator_profile?: { username: string, avatar_url: string };
    creator?: any;
    participants?: ChallengeParticipant[];
    is_public?: boolean;
    max_participants?: number | null;
    is_custom_word?: boolean;
    handicap_starter?: string | null;
    handicap_starters?: any;
    handicap_enforced?: boolean;
    marathon_timers?: Record<number, number> | null;
}

export interface MarathonProgress {
    id: string;
    participation_id: string;
    word_length: number;
    status: 'playing' | 'completed' | 'timed_out';
    score: number;
    attempts: number;
    guesses: any[];
    hints_used: boolean;
    hint_record: any | null;
    time_taken: number | null;
    started_at: string;
    completed_at: string | null;
}

export interface ChallengeParticipant {
    id: string;
    challenge_id: string;
    user_id: string;
    status: 'pending' | 'playing' | 'completed' | 'declined' | 'timed_out' | 'host';
    score: number;
    attempts: number;
    guesses: any; 
    hints_used: boolean;
    hint_record: any | null;
    time_taken: number | null;
    started_at: string | null;
    completed_at: string | null;
    profiles?: { username: string, avatar_url: string };
    marathon_progress?: MarathonProgress[];
}

/**
 * Legacy hook for Real-time Challenge subscriptions.
 * Network requests have been migrated to TanStack Query (useChallengeQueries.ts).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const useChallenge = (_user: AppUser | null) => {
    const [participants, setParticipants] = useState<ChallengeParticipant[]>([]);

    const normalizeParticipation = useCallback((p: any, challenge: any) => {
        if (!p || !challenge) return p;
        if (challenge.mode !== 'LIVE' || !challenge.max_time || p.status !== 'playing' || !p.started_at) return p;

        const start = new Date(p.started_at).getTime();
        const now = Date.now();
        const limitMs = (challenge.max_time * 60 * 1000) + (2 * 60 * 1000); // 2 min buffer

        if (now - start > limitMs) {
            return { ...p, status: 'timed_out' as const };
        }
        return p;
    }, []);

    const subscribeToParticipants = useCallback((challengeId: string) => {
        const channelName = `challenge_participants_${challengeId}`;
        
        // Clear previous participants immediately to prevent stale data flash
        setParticipants([]);

        // Remove existing channel if it exists
        const existingChannel = supabase.getChannels().find(c => (c as any).topic === `realtime:${channelName}`);
        if (existingChannel) {
            supabase.removeChannel(existingChannel);
        }

        const fetchAndSet = async () => {
            // Fetch challenge mode/max_time and participants in a single query by using join if possible, 
            // but challenge mode is static mostly. Let's just fetch participants.
            const { data: challengeData } = await supabase
                .from('challenges')
                .select('mode, max_time')
                .eq('id', challengeId)
                .single();

            const { data: parts } = await supabase
                .from('challenge_participants')
                .select('*, profiles(username, avatar_url), marathon_progress:challenge_participants_marathon(*)')
                .eq('challenge_id', challengeId)
                .order('score', { ascending: false });

            if (parts && challengeData) {
                const normalized = parts.map((p: any) => normalizeParticipation(p, challengeData));
                setParticipants(normalized as ChallengeParticipant[]);
            }
        };

        const channel = supabase
            .channel(channelName)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'challenge_participants',
                filter: `challenge_id=eq.${challengeId}`
            }, fetchAndSet)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'challenge_participants_marathon'
            }, () => {
                // For marathon progress, we might need a more targeted update, but fetchAndSet is safe
                fetchAndSet();
            })
            .subscribe();

        // Initial fetch
        fetchAndSet();

        return channel;
    }, [normalizeParticipation]);

    return {
        subscribeToParticipants,
        participants
    };
};
