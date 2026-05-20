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
            
            // 1. Fetch all challenges I am a participant in
            const { data: participations, error: pError } = await supabase
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
                .eq('user_id', userId);

            if (pError) throw pError;

            // 2. Fetch all challenges I created
            const { data: createdChallenges, error: cError } = await supabase
                .from('challenges')
                .select(`
                    *,
                    creator:profiles!creator_id(username, avatar_url),
                    participants:challenge_participants(
                        *,
                        profiles(username, avatar_url),
                        marathon_progress:challenge_participants_marathon(*)
                    )
                `)
                .eq('creator_id', userId);

            if (cError) throw cError;

            // 3. Merge them. If I'm both creator and participant, Query 1 has the full record.
            const finalResults = participations ? [...participations] : [];
            const participatedIds = new Set(finalResults.map(p => p.challenge_id));

            createdChallenges?.forEach(challenge => {
                if (!participatedIds.has(challenge.id)) {
                    // Synthetic participation record for creators who aren't playing
                    finalResults.push({
                        id: `host-${challenge.id}`,
                        challenge_id: challenge.id,
                        user_id: userId,
                        status: 'host', // Special frontend-only status
                        score: 0,
                        attempts: 0,
                        guesses: [],
                        challenge
                    });
                }
            });

            return finalResults.sort((a, b) => {
                const dateA = new Date(a.challenge.created_at).getTime();
                const dateB = new Date(b.challenge.created_at).getTime();
                return dateB - dateA;
            });
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
 * Helper to count yellow + green matches between a starter word and a target word.
 */
function getMatchCount(starter: string, target: string): number {
    const s = starter.toUpperCase().split('');
    const t = target.toUpperCase().split('');
    let matches = 0;

    // First pass: correct matches (green)
    s.forEach((char, i) => {
        if (char === t[i]) {
            matches++;
            s[i] = '_';
            t[i] = '_';
        }
    });

    // Second pass: present matches (yellow)
    s.forEach((char) => {
        if (char !== '_') {
            const idx = t.indexOf(char);
            if (idx !== -1) {
                matches++;
                t[idx] = '_';
            }
        }
    });

    return matches;
}

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
            lifespanHours = 24, marathonTimers = null
        }: any) => {
            const salt = Math.random().toString(36).substring(2, 15);
            let actualLength = length;
            let targetWord: string;

            const plainMarathonTargets: Record<number, string> = {};
            let plainRegularTarget = '';

            if (isCustomWord) {
                if (length === 1) { // Marathon custom word
                    const marathonWords: Record<number, string> = {};
                    [3, 4, 5, 6, 7].forEach(l => {
                        const word = (customWords[l] || getRandomWord(l)).toUpperCase();
                        plainMarathonTargets[l] = word;
                        marathonWords[l] = obfuscateWord(word, salt);
                    });
                    targetWord = JSON.stringify(marathonWords);
                } else {
                    actualLength = length === 0 ? Math.floor(Math.random() * 5) + 3 : length;
                    const plainWord = (customWord || getRandomWord(actualLength)).toUpperCase();
                    plainRegularTarget = plainWord;
                    targetWord = obfuscateWord(plainWord, salt);
                }
            } else {
                if (length === 1) { // Marathon
                    const marathonWords: Record<number, string> = {};
                    [3, 4, 5, 6, 7].forEach(l => {
                        const word = getRandomWord(l).toUpperCase();
                        plainMarathonTargets[l] = word;
                        marathonWords[l] = obfuscateWord(word, salt);
                    });
                    targetWord = JSON.stringify(marathonWords);
                } else {
                    actualLength = length === 0 ? Math.floor(Math.random() * 5) + 3 : length;
                    const plainWord = getRandomWord(actualLength).toUpperCase();
                    plainRegularTarget = plainWord;
                    targetWord = obfuscateWord(plainWord, salt);
                }
            }

            let finalHandicapStarter = handicapStarter;
            let finalHandicapStarters = handicapStarters;

            if (handicapStarter === '__SYSTEM_RANDOM__') {
                if (length === 1) { // Marathon
                    const startersObj: Record<number, string> = {};
                    [3, 4, 5, 6, 7].forEach(l => {
                        const target = plainMarathonTargets[l] || getRandomWord(l).toUpperCase();
                        const maxAllowed = l <= 4 ? 1 : 3;
                        let starter = getRandomWord(l).toUpperCase();
                        let limit = 0;
                        while (limit < 200) {
                            if (starter !== target && getMatchCount(starter, target) <= maxAllowed) {
                                break;
                            }
                            starter = getRandomWord(l).toUpperCase();
                            limit++;
                        }
                        startersObj[l] = starter;
                    });
                    finalHandicapStarters = startersObj;
                    finalHandicapStarter = null;
                } else {
                    const target = plainRegularTarget || getRandomWord(actualLength).toUpperCase();
                    const maxAllowed = actualLength <= 4 ? 1 : 3;
                    let starter = getRandomWord(actualLength).toUpperCase();
                    let limit = 0;
                    while (limit < 200) {
                        if (starter !== target && getMatchCount(starter, target) <= maxAllowed) {
                            break;
                        }
                        starter = getRandomWord(actualLength).toUpperCase();
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
                    handicap_enforced: handicapEnforced,
                    marathon_timers: marathonTimers
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
