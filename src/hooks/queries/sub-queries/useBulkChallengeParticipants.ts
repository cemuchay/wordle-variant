import { supabase } from "@/lib/supabaseClient";
import { safeLocalStorage } from "@/utils/storage";
import { useQuery } from "@tanstack/react-query";
import {
   CHALLENGE_PARTICIPANTS_SELECT,
   mapParticipant,
} from "../useChallengeQueries";

const BULK_PARTICIPANTS_CACHE_KEY = "wordle_bulk_participants_cache";

export const useBulkChallengeParticipantsSub = (challengeIds: string[]) => {
   return useQuery({
      staleTime: 30_000,
      gcTime: 300_000,

      queryKey: ["bulk-challenge-participants", challengeIds],
      queryFn: async () => {
         if (challengeIds.length === 0) return {};

         const { data, error } = await supabase
            .from("challenge_participants")
            .select(CHALLENGE_PARTICIPANTS_SELECT)
            .in("challenge_id", challengeIds);

         if (error) throw error;

         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         const grouped = (data || []).reduce<Record<string, any[]>>((acc, p) => {
            const challengeId = p.challenge_id;
            if (!acc[challengeId]) acc[challengeId] = [];
            acc[challengeId].push(mapParticipant(p));
            return acc;
         }, {});

         try {
            const existingRaw = safeLocalStorage.getItem(BULK_PARTICIPANTS_CACHE_KEY);
            const existing = existingRaw ? JSON.parse(existingRaw) : {};
            const merged = { ...existing, ...grouped };
            safeLocalStorage.setItem(BULK_PARTICIPANTS_CACHE_KEY, JSON.stringify(merged));
         } catch {
            // Ignore storage errors
         }

         return grouped;
      },
      placeholderData: (previousData) => {
         if (previousData && Object.keys(previousData).length > 0) {
            return previousData;
         }
         try {
            const cachedRaw = safeLocalStorage.getItem(BULK_PARTICIPANTS_CACHE_KEY);
            if (cachedRaw) {
               const parsed = JSON.parse(cachedRaw);
               if (parsed && typeof parsed === "object") {
                  return parsed;
               }
            }
         } catch {
            // Ignore parse error
         }
         return undefined;
      },
      enabled: challengeIds.length > 0,
   });
};
