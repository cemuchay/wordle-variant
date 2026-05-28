/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState, useRef } from 'react';
import { supabase } from '../lib/supabaseClient';
import type { AppUser } from '../types/game';
import { safeSessionStorage } from '../utils/storage';

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
    handicap_starter_is_random?: boolean;
    disable_hints?: boolean;
    marathon_timers?: Record<number, number> | null;
    marathon_force_order?: boolean;
}

export interface MarathonProgress {
    id: string;
    participation_id: string;
    game_index: number;
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
    user_id?: string | null;
    guest_id?: string | null;
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
    guest_profiles?: { username: string, avatar_url: string };
    marathon_progress?: MarathonProgress[];
}

/**
 * Legacy hook for Real-time Challenge subscriptions.
 * Network requests have been migrated to TanStack Query (useChallengeQueries.ts).
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const useChallenge = (_user: AppUser | null) => {
    const [participants, setParticipants] = useState<ChallengeParticipant[]>([]);
    const [loadingParticipants, setLoadingParticipants] = useState(false);
    const [participantsError, setParticipantsError] = useState<string | null>(null);
    
    const participantsRef = useRef<ChallengeParticipant[]>([]);
    const activeChallengeIdRef = useRef<string | null>(null);
    const fetchRef = useRef<(() => Promise<void>) | null>(null);

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
        
        activeChallengeIdRef.current = challengeId;
        
        // Attempt to load from sessionStorage to prevent loading flash
        let initialParticipants: ChallengeParticipant[] = [];
        try {
            const cached = safeSessionStorage.getItem(`wordle_challenge_participants_${challengeId}`);
            if (cached) {
                initialParticipants = JSON.parse(cached);
            }
        } catch (e) {
            console.error('Failed to parse cached participants', e);
        }

        setParticipants(initialParticipants);
        participantsRef.current = initialParticipants;
        setParticipantsError(null);

        // Remove existing channel if it exists
        const existingChannel = supabase.getChannels().find(c => (c as any).topic === `realtime:${channelName}`);
        if (existingChannel) {
            supabase.removeChannel(existingChannel);
        }

        const fetchAndSet = async () => {
            setLoadingParticipants(true);
            setParticipantsError(null);

            let attempts = 0;
            const maxAttempts = 3;
            let success = false;
            let lastError: any = null;

            while (attempts < maxAttempts && !success) {
                try {
                    attempts++;
                    const { data: challengeData, error: cError } = await supabase
                        .from('challenges')
                        .select('mode, max_time')
                        .eq('id', challengeId)
                        .single();

                    if (cError) throw cError;

                    const { data: parts, error: pError } = await supabase
                        .from('challenge_participants')
                        .select('*, profiles(username, avatar_url), guest_profiles(username, avatar_url), marathon_progress:challenge_participants_marathon(*)')
                        .eq('challenge_id', challengeId)
                        .order('score', { ascending: false });

                    if (pError) throw pError;

                    if (parts && challengeData) {
                        const mappedParts = parts.map((p: any) => ({
                            ...p,
                            profiles: p.profiles || p.guest_profiles || null
                        }));
                        const normalized = mappedParts.map((p: any) => normalizeParticipation(p, challengeData));
                        
                        // Compare structural difference to avoid redundant state updates and cache writes
                        const currentStringified = JSON.stringify(participantsRef.current);
                        const newStringified = JSON.stringify(normalized);
                        
                        if (currentStringified !== newStringified) {
                            setParticipants(normalized as ChallengeParticipant[]);
                            participantsRef.current = normalized;
                            try {
                                safeSessionStorage.setItem(`wordle_challenge_participants_${challengeId}`, newStringified);
                            } catch (e) {
                                console.error('Failed to cache participants', e);
                            }
                        }
                        success = true;
                    } else {
                        throw new Error("Challenge or participant data not found");
                    }
                } catch (err: any) {
                    console.warn(`[useChallenge] Fetch participants attempt ${attempts} failed:`, err);
                    lastError = err;
                    if (attempts < maxAttempts) {
                        await new Promise(res => setTimeout(res, 1000));
                    }
                }
            }

            setLoadingParticipants(false);
            if (!success) {
                setParticipantsError(lastError?.message || "Failed to load participants after 3 attempts.");
            }
        };

        fetchRef.current = fetchAndSet;

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
                table: 'challenge_participants_marathon',
                filter: `challenge_id=eq.${challengeId}`
            }, fetchAndSet)
            .subscribe();

        // Initial fetch
        fetchAndSet();

        return channel;
    }, [normalizeParticipation]);

    const retryFetchParticipants = useCallback(() => {
        if (fetchRef.current) {
            fetchRef.current();
        }
    }, []);

    return {
        subscribeToParticipants,
        participants,
        loadingParticipants,
        participantsError,
        retryFetchParticipants
    };
};
