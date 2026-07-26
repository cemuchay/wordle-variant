import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabaseClient";

export interface WordUpTopic {
   id: string;
   slug: string;
   name: string;
   procedural_weight: number;
   handcrafted_weave_probability: number;
   variant_weights: number[];
   emoji: string;
   gradient?: string;
   glow?: string;
   border?: string;
   svg?: string;
   description?: string;
   is_active: boolean;
   is_suspended: boolean;
   is_default_fallback: boolean;
}

export function useTopics() {
   return useQuery({
      queryKey: ["wordup_topics"],
      queryFn: async (): Promise<WordUpTopic[]> => {
         const { data, error } = await supabase
            .from("topics")
            .select("*")
            .order("name", { ascending: true });

         if (error) {
            console.warn("[useTopics] Failed to fetch topics from database, returning default fallback:", error);
            return [
               {
                  id: "fallback-mixed",
                  slug: "mixed",
                  name: "Mixed Categories",
                  procedural_weight: 0.5,
                  handcrafted_weave_probability: 0.4,
                  variant_weights: [1, 1, 1, 1, 1, 1, 1, 1, 1],
                  emoji: "🎲",
                  is_active: true,
                  is_suspended: false,
                  is_default_fallback: true,
               },
            ];
         }

         return (data || []).map((t: any) => ({
            ...t,
            procedural_weight: Number(t.procedural_weight ?? 0.5),
            handcrafted_weave_probability: Number(t.handcrafted_weave_probability ?? 0.4),
            variant_weights: Array.isArray(t.variant_weights)
               ? t.variant_weights.map(Number)
               : [1, 1, 1, 1, 1, 1, 1, 1, 1],
            is_suspended: Boolean(t.is_suspended ?? false),
         }));
      },
      staleTime: 1000 * 60 * 15, // 15 minutes cache-first
   });
}

export function useSaveTopicMutation() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async (topic: Partial<WordUpTopic> & { slug: string; name: string }) => {
         const payload = {
            slug: topic.slug,
            name: topic.name,
            procedural_weight: topic.procedural_weight ?? 0.5,
            handcrafted_weave_probability: topic.handcrafted_weave_probability ?? 0.4,
            variant_weights: topic.variant_weights ?? [1, 1, 1, 1, 1, 1, 1, 1, 1],
            emoji: topic.emoji || "💡",
            gradient: topic.gradient,
            glow: topic.glow,
            border: topic.border,
            svg: topic.svg,
            description: topic.description,
            is_active: topic.is_active ?? true,
            is_suspended: topic.is_suspended ?? false,
            is_default_fallback: topic.is_default_fallback ?? false,
         };

         const { data, error } = await supabase
            .from("topics")
            .upsert(payload, { onConflict: "slug" })
            .select()
            .single();

         if (error) throw error;
         return data;
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["wordup_topics"] });
      },
   });
}

export function useToggleTopicActiveMutation() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
         const { error } = await supabase
            .from("topics")
            .update({ is_active })
            .eq("id", id);

         if (error) throw error;
         return is_active;
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["wordup_topics"] });
      },
   });
}

export function useToggleTopicSuspendedMutation() {
   const queryClient = useQueryClient();

   return useMutation({
      mutationFn: async ({ id, is_suspended }: { id: string; is_suspended: boolean }) => {
         const { error } = await supabase
            .from("topics")
            .update({ is_suspended })
            .eq("id", id);

         if (error) throw error;
         return is_suspended;
      },
      onSuccess: () => {
         queryClient.invalidateQueries({ queryKey: ["wordup_topics"] });
      },
   });
}
