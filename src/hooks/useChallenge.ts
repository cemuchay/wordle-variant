/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback, useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { getRandomWord, obfuscateWord } from '../lib/game-logic';
import type { AppUser } from '../types/game';

export interface Challenge {
    profiles: any;
    id: string;
    creator_id: string;
    mode: 'LIVE' | 'ANYTIME' | 'MARATHON';
    word_length: number;
    target_word: string;
    salt: string;
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
    guesses: any; // Can be array or object for Marathon
    hints_used: boolean;
    hint_record: any | null;
    started_at: string | null;
    completed_at: string | null;
    profiles?: { username: string, avatar_url: string };
}

export const useChallenge = (user: AppUser | null) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [participants, setParticipants] = useState<ChallengeParticipant[]>([]);

    const fetchProfiles = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, avatar_url');
            if (error) throw error;
            return data;
        } catch (err: any) {
            console.error('Error fetching profiles:', err);
            setError(err.message || 'Failed to fetch profiles');
            return [];
        } finally {
            setLoading(false);
        }
    }, []);

    const createChallenge = useCallback(async (mode: 'LIVE' | 'ANYTIME' | 'MARATHON', length: number, maxTimeMinutes: number | null, invitedUserIds: string[] = []) => {
        if (!user) return null;
        setLoading(true);
        setError(null);
        try {
            let actualLength = length;
            let targetWord = '';
            const salt = Math.random().toString(36).substring(2, 15);

            if (mode === 'MARATHON') {
                actualLength = 0; // Indicates Marathon
                const marathonWords: Record<number, string> = {};
                [3, 4, 5, 6, 7].forEach(l => {
                    const word = getRandomWord(l);
                    marathonWords[l] = obfuscateWord(word, salt);
                });
                targetWord = JSON.stringify(marathonWords);
            } else {
                // If length is 0 (Random), pick a random length between 3 and 7
                actualLength = length === 0 ? Math.floor(Math.random() * 5) + 3 : length;
                const plainWord = getRandomWord(actualLength);
                targetWord = obfuscateWord(plainWord, salt);
            }

            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            const { data: challenge, error: challengeError } = await supabase
                .from('challenges')
                .insert([{
                    creator_id: user.id,
                    mode,
                    word_length: actualLength,
                    target_word: targetWord,
                    salt: salt,
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
        } catch (err: any) {
            console.error('Error creating challenge:', err);
            setError(err.message || 'Failed to create challenge');
            return null;
        } finally {
            setLoading(false);
        }
    }, [user]);

    const fetchChallenge = useCallback(async (id: string) => {
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('challenges')
                .select('*, profiles!creator_id(username, avatar_url)')
                .eq('id', id)
                .maybeSingle();

            if (error) throw error;
            return data as Challenge;
        } catch (err: any) {
            console.error('Error fetching challenge:', err);
            setError(err.message || 'Failed to fetch challenge');
            return null;
        } finally {
            setLoading(false);
        }
    }, []);

    const joinChallenge = useCallback(async (challengeId: string) => {
        if (!user) return null;
        setLoading(true);
        setError(null);
        try {
            // First check if already participating
            const { data: existing, error: fetchError } = await supabase
                .from('challenge_participants')
                .select('*')
                .eq('challenge_id', challengeId)
                .eq('user_id', user.id)
                .maybeSingle();

            if (fetchError) throw fetchError;
            if (existing) return existing as ChallengeParticipant;

            // If not, then join as pending
            const { data, error } = await supabase
                .from('challenge_participants')
                .insert([{
                    challenge_id: challengeId,
                    user_id: user.id,
                    status: 'pending'
                }])
                .select()
                .single();

            if (error) throw error;
            return data as ChallengeParticipant;
        } catch (err: any) {
            console.error('Error joining challenge:', err);
            setError(err.message || 'Failed to join challenge');
            return null;
        } finally {
            setLoading(false);
        }
    }, [user]);

    const startChallenge = useCallback(async (participationId: string) => {
        setLoading(true);
        setError(null);
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
        } catch (err: any) {
            console.error('Error starting challenge:', err);
            setError(err.message || 'Failed to start challenge');
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    const submitChallengeResult = useCallback(async (participationId: string, result: {
        status: 'completed' | 'timed_out' | 'playing',
        score: number,
        attempts: number,
        guesses: any[],
        hints_used?: boolean,
        hint_record?: any | null
    }) => {
        try {
            const updateData: any = { ...result };
            if (result.status !== 'playing') {
                updateData.completed_at = new Date().toISOString();
            }

            const { error } = await supabase
                .from('challenge_participants')
                .update(updateData)
                .eq('id', participationId);

            if (error) throw error;
            return true;
        } catch (err) {
            console.error('Error submitting challenge result:', err);
            return false;
        }
    }, []);

    const subscribeToParticipants = useCallback((challengeId: string) => {
        const channelName = `challenge_participants_${challengeId}`;

        // Remove existing channel if it exists to avoid "after subscribe" error
        const existingChannel = supabase.getChannels().find(c => (c as any).topic === `realtime:${channelName}`);
        if (existingChannel) {
            supabase.removeChannel(existingChannel);
        }

        const channel = supabase
            .channel(channelName)
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
        const fetchInitialParticipants = async () => {
            setLoading(true);
            try {
                const { data } = await supabase
                    .from('challenge_participants')
                    .select('*, profiles(username, avatar_url)')
                    .eq('challenge_id', challengeId)
                    .order('score', { ascending: false });

                if (data) setParticipants(data as ChallengeParticipant[]);
            } finally {
                setLoading(false);
            }
        };

        fetchInitialParticipants();

        return channel;
    }, []);

    const fetchMyChallenges = useCallback(async () => {
        if (!user) return [];
        setLoading(true);
        setError(null);
        try {
            const { data, error } = await supabase
                .from('challenge_participants')
                .select(`
                    *,
                    challenge:challenges(
                        *,
                        creator:profiles!creator_id(username, avatar_url),
                        participants:challenge_participants(
                            *,
                            profiles(username, avatar_url)
                        )
                    )
                `)
                .eq('user_id', user.id)
                .order('started_at', { ascending: false, nullsFirst: true });

            if (error) throw error;
            return data;
        } catch (err: any) {
            console.error('Error fetching my challenges:', err);
            setError(err.message || 'Failed to fetch challenges');
            return [];
        } finally {
            setLoading(false);
        }
    }, [user]);

    return {
        loading,
        error,
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
