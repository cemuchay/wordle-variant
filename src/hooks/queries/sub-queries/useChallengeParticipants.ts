import { supabase } from "@/lib/supabaseClient";
import { useQuery } from "@tanstack/react-query";
import {
   CHALLENGE_PARTICIPANTS_SELECT,
   mapParticipant,
} from "../useChallengeQueries";

const useChallengeParticipantsSub = (challengeId: string | null) => {
   return useQuery({
      queryKey: ["challenge-participants", challengeId],
      queryFn: async () => {
         if (!challengeId) return [];
         const { data, error } = await supabase
            .from("challenge_participants")
            .select(CHALLENGE_PARTICIPANTS_SELECT)
            .eq("challenge_id", challengeId)
            .order("score", { ascending: false });

         if (error) throw error;
         return (data || []).map(mapParticipant);
      },
      enabled: !!challengeId,
   });
};

export default useChallengeParticipantsSub;
