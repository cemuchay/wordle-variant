import { supabase } from "@/lib/supabaseClient";
import type { Challenge } from "@/types/game";
import { safeSessionStorage } from "@/utils/storage";
import { useQuery } from "@tanstack/react-query";
import { CHALLENGE_DETAILS_SELECT, mapChallenge } from "../useChallengeQueries";

export const useChallengeDataSub = (challengeId: string | null) => {
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

         // 1. Defer the storage write to the microtask queue.
         // This ensures it doesn't block the immediate return and rendering of the fetched data.
         Promise.resolve().then(() => {
            try {
               safeSessionStorage.setItem(
                  `wordle_challenge_detail_${challengeId}`,
                  JSON.stringify(mapped),
               );
            } catch (e) {
               console.warn("Failed to cache challenge details", e);
            }
         });

         return mapped;
      },
      enabled: !!challengeId,
      // 2. The function form of initialData is "lazy".
      // React Query will only execute this synchronous read once when the query mounts,
      // rather than on every single component render.
      initialData: () => {
         if (!challengeId) return undefined;
         try {
            const cached = safeSessionStorage.getItem(
               `wordle_challenge_detail_${challengeId}`,
            );
            return cached ? JSON.parse(cached) : undefined;
         } catch (e) {
            console.warn("Failed to load initial challenge detail cache", e);
            return undefined;
         }
      },
   });
};
