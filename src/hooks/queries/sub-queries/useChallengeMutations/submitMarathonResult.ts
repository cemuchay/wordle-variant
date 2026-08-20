/* eslint-disable @typescript-eslint/no-explicit-any */
import { supabase } from "@/lib/supabaseClient";
import { useMutation, useQueryClient } from "@tanstack/react-query";

/* refactor later*/
const useSubmitMarathonResult = () => {
   const queryClient = useQueryClient();
   return useMutation({
      mutationFn: async ({
         participationId,
         challengeId,
         gameIndex,
         wordLength,
         result,
         playDate,
      }: {
         participationId: string;
         challengeId: string;
         gameIndex?: number;
         wordLength: number;
         result: any;
         playDate?: string;
      }) => {
         const resolvedGameIndex =
            gameIndex !== undefined ? gameIndex : wordLength - 3;
         const finalPlayDate = playDate || "1970-01-01";

         // Guard against status downgrade: if record in DB is already completed/timed_out, do not overwrite with 'playing'
         if (result?.status === "playing") {
            const { data: existingRecord } = await supabase
               .from("challenge_participants_marathon")
               .select("status")
               .eq("participation_id", participationId)
               .eq("game_index", resolvedGameIndex)
               .eq("play_date", finalPlayDate)
               .maybeSingle();

            if (
               existingRecord?.status === "completed" ||
               existingRecord?.status === "timed_out"
            ) {
               return true;
            }
         }

         const data: any = {
            participation_id: participationId,
            challenge_id: challengeId,
            game_index: resolvedGameIndex,
            word_length: wordLength,
            play_date: finalPlayDate,
            ...result,
         };

         if (result?.status && result.status !== "playing") {
            data.completed_at = new Date().toISOString();
         }

         const { error } = await supabase
            .from("challenge_participants_marathon")
            .upsert(data, {
               onConflict: "participation_id,game_index,play_date",
            });

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

export default useSubmitMarathonResult;
