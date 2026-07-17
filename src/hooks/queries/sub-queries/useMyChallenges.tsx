/**
 * Hook to fetch all challenges a user is participating in.
 * Only fetches the user's own participation and challenge metadata.
 */

import { supabase } from "@/lib/supabaseClient";
import { safeLocalStorage, safeSessionStorage } from "@/utils/storage";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CHALLENGE_DETAILS_SELECT, mapParticipation, mapChallenge } from "../useChallengeQueries";

export const useMyChallengesSub = (userId: string | undefined) => {
   // Use a lazy state initializer instead of useMemo.
   // This runs exactly once on mount, avoids render-blocking I/O, 
   // and satisfies the React Compiler's purity rules.
   const [recentIds] = useState<string[]>(() => {
      try {
         const stored = safeLocalStorage.getItem("wordle_recent_challenges");
         if (!stored) return [];

         const parsed = JSON.parse(stored);
         return Array.isArray(parsed)
            ? parsed.filter((id): id is string => !!id && id !== "null" && id !== "undefined")
            : [];
      } catch (e) {
         console.error("Failed to parse recent challenges", e);
         return [];
      }
   });

   return useQuery({
      staleTime: 30_000,
      gcTime: 300_000,
      enabled: !!userId || recentIds.length > 0,
      queryKey: ["my-challenges", userId],
      queryFn: async () => {
         if (!userId && recentIds.length === 0) return [];

         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         let participations: any[] = [];
         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         let createdChallenges: any[] = [];

         if (userId) {
            // 2. Fire independent queries concurrently using Promise.all
            const [pResponse, cResponse] = await Promise.all([
               supabase
                  .from("challenge_participants")
                  .select(
                     `id, challenge_id, user_id, guest_id, status, score, attempts, hints_used, time_taken, started_at, completed_at, target_words,
                        guest_profiles(username, avatar_url),
                        profiles(username, avatar_url),
                        marathon_progress:challenge_participants_marathon(
                            id, participation_id, game_index, word_length, status, score, attempts, hints_used, time_taken, started_at, completed_at, target_words
                        ),
                        challenge:challenges(${CHALLENGE_DETAILS_SELECT})
                    `,
                  )
                  .or(`user_id.eq.${userId},guest_id.eq.${userId}`)
                  .not("status", "in", '("completed","timed_out","declined")'),

               supabase
                  .from("challenges")
                  .select(CHALLENGE_DETAILS_SELECT)
                  .eq("creator_id", userId)
            ]);

            if (pResponse.error) throw pResponse.error;
            if (cResponse.error) throw cResponse.error;

            participations = pResponse.data || [];
            createdChallenges = cResponse.data || [];
         }

         // 3. Merge results
         const finalResults = participations.map(mapParticipation);
         const participatedIds = new Set(finalResults.map((p) => p.challenge_id));

         createdChallenges.forEach((challenge) => {
            const mappedChallenge = mapChallenge(challenge);
            if (!participatedIds.has(mappedChallenge.id)) {
               finalResults.push({
                  id: `host-${mappedChallenge.id}`,
                  challenge_id: mappedChallenge.id,
                  user_id: userId || null,
                  status: "host",
                  score: 0,
                  attempts: 0,
                  guesses: [],
                  challenge: mappedChallenge,
               });
            }
         });

         // 4. Fetch missing recent challenges
         const missingIds = recentIds.filter((id) => !participatedIds.has(id));
         if (missingIds.length > 0) {
            const { data: recentChallenges, error: rError } = await supabase
               .from("challenges")
               .select(CHALLENGE_DETAILS_SELECT)
               .in("id", missingIds);

            if (!rError && recentChallenges) {
               recentChallenges.forEach((challenge) => {
                  const mappedChallenge = mapChallenge(challenge);
                  finalResults.push({
                     id: `viewed-${challenge.id}`,
                     challenge_id: challenge.id,
                     user_id: userId || null,
                     status: "viewed",
                     score: 0,
                     attempts: 0,
                     guesses: [],
                     challenge: mappedChallenge,
                  });
               });
            }
         }

         const sortedResults = finalResults.sort((a, b) => {
            return new Date(b.challenge.created_at).getTime() - new Date(a.challenge.created_at).getTime();
         });

         // Note: React Query handles caching automatically. 
         // Manual sessionStorage is redundant here, but kept if you have external dependencies relying on it.
         if (userId) {
            try {
               safeSessionStorage.setItem(`wordle_my_challenges_${userId}`, JSON.stringify(sortedResults));
            } catch (e) {
               console.error("Failed to cache challenges list", e);
            }
         }

         return sortedResults;
      },
      placeholderData: () => {
         if (!userId) return [];
         try {
            const cached = safeSessionStorage.getItem(`wordle_my_challenges_${userId}`);
            return cached ? JSON.parse(cached) : undefined;
         } catch (e) {
            console.error("Failed to load placeholder challenges cache", e);
            return undefined;
         }
      },
   });
};

export default useMyChallengesSub