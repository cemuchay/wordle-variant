import { supabase } from "@/lib/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import {
   CHALLENGE_PARTICIPANTS_SELECT,
   mapParticipant,
} from "../useChallengeQueries";

export const useBulkChallengeParticipantsSub = (challengeIds: string[]) => {
   return useQuery({
      staleTime: 10_000,
      gcTime: 60_000,

      queryKey: ["bulk-challenge-participants", challengeIds],
      queryFn: async () => {
         if (challengeIds.length === 0) return {};

         const { data, error } = await supabase
            .from("challenge_participants")
            .select(CHALLENGE_PARTICIPANTS_SELECT)
            .in("challenge_id", challengeIds);

         if (error) throw error;

         // eslint-disable-next-line @typescript-eslint/no-explicit-any
         return (data || []).reduce<Record<string, any[]>>((acc, p) => {
            const challengeId = p.challenge_id;
            if (!acc[challengeId]) acc[challengeId] = [];
            acc[challengeId].push(mapParticipant(p));
            return acc;
         }, {});
      },
      enabled: challengeIds.length > 0,
   });
};
