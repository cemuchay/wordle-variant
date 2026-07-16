/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabaseClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const useSubmitResult = () => {
   const queryClient = useQueryClient();
   return useMutation({
      mutationFn: async ({ participationId, result }: any) => {
         const updateData: any = { ...result };
         if (result?.status && result.status !== "playing") {
            updateData.completed_at = new Date().toISOString();
         }

         const { error } = await supabase
            .from("challenge_participants")
            .update(updateData)
            .eq("id", participationId);

         if (error) throw error;
         return true;
      },
      onSuccess: (_, variables) => {
         if (variables?.result?.status !== "playing") {
            queryClient.invalidateQueries({ queryKey: ["my-challenges"] });
            queryClient.invalidateQueries({ queryKey: ["challenge"] });
         }
      },
   });
};

export default useSubmitResult;
