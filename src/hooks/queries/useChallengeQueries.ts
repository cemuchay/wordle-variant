/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabaseClient';
import { getRandomWord, obfuscateWord } from '../../lib/game-logic';
import { type Challenge, } from '../useChallenge';

/**
 * Hook to fetch all challenges a user is participating in.
 */
export const useMyChallenges = (userId: string | undefined) => {
    return useQuery({
        queryKey: ['my-challenges', userId],
        queryFn: async () => {
            if (!userId) return [];
            const { data, error } = await supabase
                .from('challenge_participants')
                .select(`
                    *,
                    marathon_progress:challenge_participants_marathon(*),
                    challenge:challenges(
                        *,
                        creator:profiles!creator_id(username, avatar_url),
                        participants:challenge_participants(
                            *,
                            profiles(username, avatar_url),
                            marathon_progress:challenge_participants_marathon(*)
                        )
                    )
                `)
                .eq('user_id', userId)
                .order('started_at', { ascending: false, nullsFirst: true });

            if (error) throw error;
            return data || [];
        },
        enabled: !!userId,
    });
};

/**
 * Hook to fetch all user profiles (for invitations).
 */
export const useAvailableProfiles = (currentUserId: string | undefined) => {
    return useQuery({
        queryKey: ['profiles'],
        queryFn: async () => {
            const { data, error } = await supabase
                .from('profiles')
                .select('id, username, avatar_url');
            if (error) throw error;
            return data.filter(p => p.id !== currentUserId);
        },
        enabled: !!currentUserId,
    });
};

/**
 * Hook to fetch a specific challenge by ID.
 */
export const useChallengeData = (challengeId: string | null) => {
    return useQuery({
        queryKey: ['challenge', challengeId],
        queryFn: async () => {
            if (!challengeId) return null;
            const { data, error } = await supabase
                .from('challenges')
                .select(`
                    *, 
                    profiles!creator_id(username, avatar_url),
                    participants:challenge_participants(
                        *,
                        profiles(username, avatar_url),
                        marathon_progress:challenge_participants_marathon(*)
                    )
                `)
                .eq('id', challengeId)
                .maybeSingle();

            if (error) throw error;
            return data as Challenge;
        },
        enabled: !!challengeId,
    });
};

/**
 * Mutations for Challenge Lifecycle
 */
export const useChallengeMutations = () => {
    const queryClient = useQueryClient();

    const createChallenge = useMutation({
        mutationFn: async ({ 
            creatorId, mode, length, maxTime, invitedIds,
            isPublic = false, maxParticipants = null,
            isCustomWord = false, customWord = '', customWords = {},
            handicapStarter = null, handicapStarters = null, handicapEnforced = false,
            lifespanHours = 24
        }: any) => {
            const salt = Math.random().toString(36).substring(2, 15);
            let actualLength = length;
            let targetWord = '';

            if (isCustomWord) {
                if (length === 1) { // Marathon custom word
                    const marathonWords: Record<number, string> = {};
                    [3, 4, 5, 6, 7].forEach(l => {
                        const word = customWords[l] || getRandomWord(l);
                        marathonWords[l] = obfuscateWord(word.toUpperCase(), salt);
                    });
                    targetWord = JSON.stringify(marathonWords);
                } else {
                    actualLength = length === 0 ? Math.floor(Math.random() * 5) + 3 : length;
                    const plainWord = customWord || getRandomWord(actualLength);
                    targetWord = obfuscateWord(plainWord.toUpperCase(), salt);
                }
            } else {
                if (length === 1) { // Marathon
                    const marathonWords: Record<number, string> = {};
                    [3, 4, 5, 6, 7].forEach(l => {
                        const word = getRandomWord(l);
                        marathonWords[l] = obfuscateWord(word, salt);
                    });
                    targetWord = JSON.stringify(marathonWords);
                } else {
                    actualLength = length === 0 ? Math.floor(Math.random() * 5) + 3 : length;
                    const plainWord = getRandomWord(actualLength);
                    targetWord = obfuscateWord(plainWord, salt);
                }
            }

            let finalHandicapStarter = handicapStarter;
            let finalHandicapStarters = handicapStarters;

            if (handicapStarter === '__SYSTEM_RANDOM__') {
                if (length === 1) { // Marathon
                    const startersObj: Record<number, string> = {};
                    [3, 4, 5, 6, 7].forEach(l => {
                        let target = '';
                        if (isCustomWord && customWords[l]) {
                            target = customWords[l].toUpperCase();
                        }
                        let starter = getRandomWord(l);
                        let limit = 0;
                        while (starter === target && limit < 100) {
                            starter = getRandomWord(l);
                            limit++;
                        }
                        startersObj[l] = starter;
                    });
                    finalHandicapStarters = startersObj;
                    finalHandicapStarter = null;
                } else {
                    let target = '';
                    if (isCustomWord && customWord) {
                        target = customWord.toUpperCase();
                    }
                    let starter = getRandomWord(actualLength);
                    let limit = 0;
                    while (starter === target && limit < 100) {
                        starter = getRandomWord(actualLength);
                        limit++;
                    }
                    finalHandicapStarter = starter;
                    finalHandicapStarters = null;
                }
            }

            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + lifespanHours);

            const { data: challenge, error: challengeError } = await supabase
                .from('challenges')
                .insert([{
                    creator_id: creatorId,
                    mode,
                    word_length: actualLength,
                    target_word: targetWord,
                    salt: salt,
                    max_time: maxTime,
                    expires_at: expiresAt.toISOString(),
                    is_public: isPublic,
                    max_participants: maxParticipants,
                    is_custom_word: isCustomWord,
                    handicap_starter: finalHandicapStarter,
                    handicap_starters: finalHandicapStarters,
                    handicap_enforced: handicapEnforced
                }])
                .select()
                .single();

            if (challengeError) throw challengeError;

            const allParticipants = isCustomWord
                ? invitedIds.filter((id: string) => id !== creatorId)
                : [creatorId, ...invitedIds.filter((id: string) => id !== creatorId)];

            const participantInserts = allParticipants.map((uid: string) => ({
                challenge_id: challenge.id,
                user_id: uid,
                status: 'pending'
            }));

            if (participantInserts.length > 0) {
                await supabase.from('challenge_participants').insert(participantInserts);
            }
            return challenge;
        },
        onSuccess: (_, variables) => {
            queryClient.invalidateQueries({ queryKey: ['my-challenges', variables.creatorId] });
        }
    });

    const submitResult = useMutation({
        mutationFn: async ({ participationId, result }: any) => {
            const updateData: any = { ...result };
            if (result.status && result.status !== 'playing') {
                updateData.completed_at = new Date().toISOString();
            }

            const { error } = await supabase
                .from('challenge_participants')
                .update(updateData)
                .eq('id', participationId);

            if (error) throw error;
            return true;
        },
        onSuccess: (_, variables) => {
            // Only invalidate if the game is actually finished or timed out
            // This avoids heavy re-fetches on every single guess
            if (variables.result.status !== 'playing') {
                queryClient.invalidateQueries({ queryKey: ['my-challenges'] });
                queryClient.invalidateQueries({ queryKey: ['challenge'] });
            }
        }
    });

    const joinChallenge = useMutation({
        mutationFn: async ({ challengeId, userId }: { challengeId: string, userId: string }) => {
            // First check if already participating
            const { data: existing, error: fetchError } = await supabase
                .from('challenge_participants')
                .select('*, challenge:challenges(*), marathon_progress:challenge_participants_marathon(*)')
                .eq('challenge_id', challengeId)
                .eq('user_id', userId)
                .maybeSingle();

            if (fetchError) throw fetchError;
            if (existing) return existing;

            // Fetch challenge details to validate participation limits
            const { data: challenge, error: chalError } = await supabase
                .from('challenges')
                .select('*, participants:challenge_participants(id)')
                .eq('id', challengeId)
                .single();

            if (chalError) throw chalError;

            // Check guest/user permission if private
            const isCreator = challenge.creator_id === userId;
            if (!challenge.is_public && !isCreator) {
                throw new Error("This is a private challenge. You must be invited to join.");
            }

            // Check participant limit
            const maxParts = challenge.max_participants || 100;
            const currentParts = challenge.participants?.length || 0;
            if (currentParts >= maxParts) {
                throw new Error("Challenge participant limit reached.");
            }

            // If not, then join as pending
            const { data, error } = await supabase
                .from('challenge_participants')
                .insert([{
                    challenge_id: challengeId,
                    user_id: userId,
                    status: 'pending'
                }])
                .select('*, challenge:challenges(*), marathon_progress:challenge_participants_marathon(*)')
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-challenges'] });
        }
    });

    const startChallenge = useMutation({
        mutationFn: async (participationId: string) => {
            const { error } = await supabase
                .from('challenge_participants')
                .update({
                    status: 'playing',
                    started_at: new Date().toISOString()
                })
                .eq('id', participationId);

            if (error) throw error;
            return true;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['my-challenges'] });
            queryClient.invalidateQueries({ queryKey: ['challenge'] });
        }
    });

    const submitMarathonResult = useMutation({
        mutationFn: async ({ participationId, wordLength, result }: { participationId: string, wordLength: number, result: any }) => {
            const data: any = {
                participation_id: participationId,
                word_length: wordLength,
                ...result
            };
            
            if (result.status && result.status !== 'playing') {
                data.completed_at = new Date().toISOString();
            }

            const { error } = await supabase
                .from('challenge_participants_marathon')
                .upsert(data, { onConflict: 'participation_id, word_length' });

            if (error) throw error;
            return true;
        },
        onSuccess: (_, variables) => {
            // Only invalidate if this specific length is finished
            if (variables.result.status !== 'playing') {
                queryClient.invalidateQueries({ queryKey: ['my-challenges'] });
                queryClient.invalidateQueries({ queryKey: ['challenge'] });
            }
        }
    });

    return { createChallenge, submitResult, joinChallenge, startChallenge, submitMarathonResult };
};
