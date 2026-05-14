/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getRandomWord } from '../lib/gameLogic';
import type { AppUser } from '../types/game';

export interface Challenge {
    id: string;
    creator_id: string;
    mode: 'LIVE' | 'ANYTIME';
    word_length: number;
    target_word: string;
    max_time: number | null;
    expires_at: string;
    created_at: string;
    creator_profile?: { username: string, avatar_url: string };
}

export interface ChallengeParticipant {
    id: string;
    challenge_id: string;
    user_id: string;
    status: 'pending' | 'playing' | 'completed' | 'declined' | 'timed_out';
    score: number;
    attempts: number;
    guesses: any[];
    started_at: string | null;
    completed_at: string | null;
    profiles?: { username: string, avatar_url: string };
}

export const useChallenge = (user: AppUser | null) => {
    const [loading, setLoading] = useState(false);
    const [participants, setParticipants] = useState<ChallengeParticipant[]>([]);

    const fetchProfiles = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, avatar_url');
            if (error) throw error;
            return data;
        } catch (err) {
            console.error('Error fetching profiles:', err);
            return [];
        }
    }, []);

    const createChallenge = useCallback(async (mode: 'LIVE' | 'ANYTIME', length: number, maxTimeMinutes: number | null, invitedUserIds: string[] = []) => {
        if (!user) return null;
        setLoading(true);
        try {
            // If length is 0 (Random), pick a random length between 3 and 7
            const actualLength = length === 0 ? Math.floor(Math.random() * 5) + 3 : length;
            const targetWord = getRandomWord(actualLength);
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            const { data: challenge, error: challengeError } = await supabase
                .from('challenges')
                .insert([{
                    creator_id: user.id,
                    mode,
                    word_length: actualLength,
                    target_word: targetWord,
                    max_time: maxTimeMinutes,
                    expires_at: expiresAt.toISOString()
                }])
                .select()
                .single();

            if (challengeError) throw challengeError;

            // Pre-register participants (creator + invited users)
            const allParticipants = [user.id, ...invitedUserIds.filter(id => id !== user.id)];
            const participantInserts = allParticipants.map(uid => ({
                challenge_id: challenge.id,
                user_id: uid,
                status: 'pending'
            }));

            const { error: partError } = await supabase
                .from('challenge_participants')
                .insert(participantInserts);

            if (partError) throw partError;

            return challenge as Challenge;
        } catch (err) {
            console.error('Error creating challenge:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, [user]);

    const fetchChallenge = useCallback(async (id: string) => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('challenges')
                .select('*, profiles!creator_id(username, avatar_url)')
                .eq('id', id)
                .maybeSingle();

            if (error) throw error;
            return data as Challenge;
        } catch (err) {
            console.error('Error fetching challenge:', err);
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const joinChallenge = useCallback(async (challengeId: string) => {
        if (!user) return null;
        try {
            const { data, error } = await supabase
                .from('challenge_participants')
                .upsert([{
                    challenge_id: challengeId,
                    user_id: user.id,
                    status: 'pending'
                }], { onConflict: 'challenge_id, user_id' })
                .select()
                .single();

            if (error) throw error;
            return data as ChallengeParticipant;
        } catch (err) {
            console.error('Error joining challenge:', err);
            return null;
        }
    }, [user]);

    const startChallenge = useCallback(async (participationId: string) => {
        try {
            const { error } = await supabase
                .from('challenge_participants')
                .update({
                    status: 'playing',
                    started_at: new Date().toISOString()
                })
                .eq('id', participationId);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Error starting challenge:', err);
            return false;
        }
    }, []);

    const submitChallengeResult = useCallback(async (participationId: string, result: {
        status: 'completed' | 'timed_out' | 'playing',
        score: number,
        attempts: number,
        guesses: any[]
    }) => {
        try {
            const { error } = await supabase
                .from('challenge_participants')
                .update({
                    ...result,
                    completed_at: new Date().toISOString()
                })
                .eq('id', participationId);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Error submitting challenge result:', err);
            return false;
        }
    }, []);

    const subscribeToParticipants = useCallback((challengeId: string) => {
        const channel = supabase
            .channel(`challenge_participants_${challengeId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'challenge_participants',
                filter: `challenge_id=eq.${challengeId}`
            }, async () => {
                // Refresh all participants to get profiles too
                const { data } = await supabase
                    .from('challenge_participants')
                    .select('*, profiles(username, avatar_url)')
                    .eq('challenge_id', challengeId)
                    .order('score', { ascending: false });

                if (data) setParticipants(data as ChallengeParticipant[]);
            })
            .subscribe();

        // Initial fetch
        supabase
            .from('challenge_participants')
            .select('*, profiles(username, avatar_url)')
            .eq('challenge_id', challengeId)
            .order('score', { ascending: false })
            .then(({ data }) => {
                if (data) setParticipants(data as ChallengeParticipant[]);
            });

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchMyChallenges = useCallback(async () => {
        if (!user) return [];
        try {
            const { data, error } = await supabase
                .from('challenge_participants')
                .select('*, challenge:challenges(*, profiles!creator_id(username, avatar_url))')
                .eq('user_id', user.id)
                .order('started_at', { ascending: false, nullsFirst: true });

            if (error) throw error;
            return data;
        } catch (err) {
            console.error('Error fetching my challenges:', err);
            return [];
        }
    }, [user]);

    return {
        loading,
        createChallenge,
        fetchChallenge,
        joinChallenge,
        startChallenge,
        submitChallengeResult,
        subscribeToParticipants,
        participants,
        fetchMyChallenges,
        fetchProfiles,
    };
};
