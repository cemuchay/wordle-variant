import { supabase } from "@/lib/supabaseClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useJoinChallenge = () => {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async ({
         challengeId,
         userId,
         isGuest = false,
      }: {
         challengeId: string;
         userId: string;
         isGuest?: boolean;
      }) => {
         const { data, error } = await supabase
            .rpc("join_challenge_safely", {
               p_challenge_id: challengeId,
               p_user_id: userId,
               p_is_guest: isGuest,
            })
            // You can chain your nested select directly to the RPC!
            .select(
               `
            id, challenge_id, user_id, guest_id, status, score, attempts, hints_used, time_taken, started_at, completed_at,
            challenge:challenges(*),
            marathon_progress:challenge_participants_marathon(
               id, participation_id, game_index, word_length, status, score, attempts, hints_used, time_taken, started_at, completed_at
            )
         `,
            )
            .single();

         if (error) throw new Error(error.message);
         return data;
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["my-challenges"] });
      },
   });
};

export default useJoinChallenge;
