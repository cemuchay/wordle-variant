import { supabase } from "@/lib/supabaseClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useStartChallenge = () => {
   const queryClient = useQueryClient();
   return useMutation({
      mutationFn: async (participationId: string) => {
         const { error } = await supabase
            .from("challenge_participants")
            .update({
               status: "playing",
               started_at: new Date().toISOString(),
            })
            .eq("id", participationId);

         if (error) throw error;
         return true;
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["my-challenges"] });
         queryClient.invalidateQueries({ queryKey: ["challenge"] });
      },
   });
};

export default useStartChallenge;
