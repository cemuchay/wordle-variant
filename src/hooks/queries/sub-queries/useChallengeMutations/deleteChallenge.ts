import { supabase } from "@/lib/supabaseClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useDeleteChallenge = () => {
   const queryClient = useQueryClient();
   return useMutation({
      mutationFn: async (challengeId: string) => {
         const { error } = await supabase
            .from("challenges")
            .delete()
            .eq("id", challengeId);

         if (error) throw error;
         return true;
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["my-challenges"] });
         queryClient.invalidateQueries({ queryKey: ["challenge"] });
      },
   });
};

export default useDeleteChallenge;
