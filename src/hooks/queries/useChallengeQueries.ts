/* eslint-disable @typescript-eslint/no-explicit-any */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";
import { type Challenge } from "../useChallenge";
import { safeLocalStorage, safeSessionStorage } from "../../utils/storage";
import useMyChallengesSub from "./sub-queries/useMyChallenges";
import useChallengeParticipantsSub from "./sub-queries/useChallengeParticipants";
import useChallengeMutationsSub from "./sub-queries/useChallengeMutations";

/**
 * Supabase select strings for reusable queries.
 */
export const CHALLENGE_PARTICIPANTS_SELECT = `
    id, challenge_id, user_id, guest_id, status, score, attempts, hints_used, time_taken, started_at, completed_at, target_words,
    profiles(username, avatar_url),
    guest_profiles(username, avatar_url),
    marathon_progress:challenge_participants_marathon(
        id, participation_id, game_index, word_length, status, score, attempts, hints_used, time_taken, started_at, completed_at, target_words
    )
`;

export const CHALLENGE_DETAILS_SELECT = `
    *,
    creator:profiles!creator_id(username, avatar_url)
`;

export const mapParticipant = (p: any) => {
   if (!p) return p;
   return {
      ...p,
      profiles: p.profiles || p.guest_profiles || null,
   };
};

export const mapChallenge = (challenge: any) => {
   if (!challenge) return challenge;
   return {
      ...challenge,
      creator: challenge.creator || challenge.guest_creator || null,
      participants: challenge.participants?.map(mapParticipant) || [],
   };
};

export const PLAYED_PAGE_SIZE = 30;

export const mapParticipation = (participation: any) => {
   if (!participation) return participation;
   return {
      ...mapParticipant(participation),
      challenge: mapChallenge(participation.challenge),
   };
};

/**
 * Hook to fetch all challenges a user is participating in.
 * Only fetches the user's own participation and challenge metadata.
 */
export const useMyChallenges = useMyChallengesSub;

/**
 * Hook to fetch a paginated page of played challenges (completed/timed_out/declined).
 * Returns 30 items per page with a total count for pagination.
 * `_section` is set to 'expired' if the challenge has expired, 'played' otherwise.
 */
export const usePlayedChallenges = (userId: string | undefined, page: number) =>
   useQuery({
      queryKey: ["played-challenges", userId, page],
      enabled: !!userId,
      staleTime: 30_000,
      gcTime: 300_000,
      queryFn: async () => {
         if (!userId) return { items: [], total: 0 };

         const from = (page - 1) * PLAYED_PAGE_SIZE;
         const to = from + PLAYED_PAGE_SIZE - 1;

         const { count: total, error: countError } = await supabase
            .from("challenge_participants")
            .select("id", { count: "exact", head: true })
            .or(`user_id.eq.${userId},guest_id.eq.${userId}`)
            .in("status", ["completed", "timed_out", "declined"]);

         if (countError) throw countError;

         const { data: raw, error: dataError } = await supabase
            .from("challenge_participants")
            .select(
               `
               id, challenge_id, user_id, guest_id, status, score, attempts, hints_used, time_taken, started_at, completed_at, target_words,
               guest_profiles(username, avatar_url),
               profiles(username, avatar_url),
               marathon_progress:challenge_participants_marathon(
                  id, participation_id, game_index, word_length, status, score, attempts, hints_used, time_taken, started_at, completed_at, target_words
               ),
               challenge:challenges(${CHALLENGE_DETAILS_SELECT})
            `,
            )
            .or(`user_id.eq.${userId},guest_id.eq.${userId}`)
            .in("status", ["completed", "timed_out", "declined"])
            .order("completed_at", { ascending: false })
            .range(from, to);

         if (dataError) throw dataError;

         const now = new Date();

         const items = (raw || []).map((p: any) => {
            const mapped = mapParticipation(p);
            const isExpired =
               mapped.challenge && new Date(mapped.challenge.expires_at) < now;
            return { ...mapped, _section: isExpired ? "expired" : "played" };
         });

         return { items, total: total || 0 };
      },
   });

/**
 * Hook to fetch all user profiles (for invitations).
 */
export const useAvailableProfiles = (currentUserId: string | undefined) => {
   return useQuery({
      staleTime: 120_000,
      gcTime: 600_000,
      queryKey: ["profiles"],
      queryFn: async () => {
         const { data, error } = await supabase
            .from("profiles")
            .select("id, username, avatar_url");
         if (error) throw error;
         return data.filter((p) => p.id !== currentUserId);
      },
      enabled: !!currentUserId,
   });
};

/**
 * Hook to fetch participants for a specific challenge.
 */
export const useChallengeParticipants = useChallengeParticipantsSub;

/**
 * Hook to fetch a specific challenge by ID (Metadata only).
 */
export const useChallengeData = (challengeId: string | null) => {
   return useQuery({
      staleTime: 60_000,
      gcTime: 300_000,
      queryKey: ["challenge", challengeId],
      queryFn: async () => {
         if (!challengeId) return null;
         const { data, error } = await supabase
            .from("challenges")
            .select(CHALLENGE_DETAILS_SELECT)
            .eq("id", challengeId)
            .maybeSingle();

         if (error) throw error;
         const mapped = mapChallenge(data) as Challenge;
         try {
            safeSessionStorage.setItem(
               `wordle_challenge_detail_${challengeId}`,
               JSON.stringify(mapped),
            );
         } catch (e) {
            console.error("Failed to cache challenge details", e);
         }
         return mapped;
      },
      enabled: !!challengeId,
      initialData: () => {
         if (!challengeId) return undefined;
         try {
            const cached = safeSessionStorage.getItem(
               `wordle_challenge_detail_${challengeId}`,
            );
            if (cached) {
               return JSON.parse(cached);
            }
         } catch (e) {
            console.error("Failed to load initial challenge detail cache", e);
         }
         return undefined;
      },
   });
};

/**
 * Hook to fetch all active public challenges for discovery (Metadata only).
 */
export const useDiscoverChallenges = () => {
   return useQuery({
      staleTime: 15_000,
      gcTime: 120_000,
      queryKey: ["discover-challenges"],
      queryFn: async () => {
         const { data, error } = await supabase
            .from("challenges")
            .select(CHALLENGE_DETAILS_SELECT)
            .or(`is_public.eq.true,is_bot_marathon.eq.true`)
            .gt("expires_at", new Date().toISOString())
            .order("created_at", { ascending: false });

         if (error) throw error;
         const mapped = (data || []).map(mapChallenge);
         try {
            safeLocalStorage.setItem(
               "wordle_discover_challenges_cache",
               JSON.stringify(mapped),
            );
         } catch (e) {
            console.error("Failed to cache discover challenges", e);
         }
         return mapped;
      },
      placeholderData: () => {
         try {
            const cached = safeLocalStorage.getItem(
               "wordle_discover_challenges_cache",
            );
            if (cached) {
               return JSON.parse(cached);
            }
         } catch (e) {
            console.error(
               "Failed to load placeholder discover challenges cache",
               e,
            );
         }
         return undefined;
      },
   });
};

/**
 * Hook to fetch participants for multiple challenges in one go.
 * Ideal for populating the challenge list with facepiles/leaderboards in parallel.
 */
export const useBulkChallengeParticipants = (challengeIds: string[]) => {
   return useQuery({
      staleTime: 10_000,
      gcTime: 60_000,
      queryKey: ["bulk-challenge-participants", challengeIds.join(",")],
      queryFn: async () => {
         if (challengeIds.length === 0) return {};
         const { data, error } = await supabase
            .from("challenge_participants")
            .select(CHALLENGE_PARTICIPANTS_SELECT)
            .in("challenge_id", challengeIds);

         if (error) throw error;

         // Group participants by challenge_id
         return (data || []).reduce((acc: any, p: any) => {
            const challengeId = p.challenge_id;
            if (!acc[challengeId]) acc[challengeId] = [];
            acc[challengeId].push(mapParticipant(p));
            return acc;
         }, {});
      },
      enabled: challengeIds.length > 0,
   });
};

/**
 * Mutations for Challenge Lifecycle
 */
export const useChallengeMutations = useChallengeMutationsSub;
