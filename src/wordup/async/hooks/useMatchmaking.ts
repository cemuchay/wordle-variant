/* eslint-disable @typescript-eslint/no-explicit-any */
import { useCallback } from "react";
import { supabase } from "../../../lib/supabaseClient";
import { useAsyncStore } from "../store/useAsyncStore";
import { generateWordUpQuestions, generateSecretKey, encryptQuestions } from "../../../utils/wordupQuestionGenerator";

export const useAsyncMatchmaking = (
   user: any,
   category: string,
   triggerToast: (msg: string, dur?: number) => void,
) => {
   const effectiveCategory = category || useAsyncStore.getState().category || "mixed";

   const createMatch = useCallback(async (targetUser: any) => {
      if (!user?.id || !targetUser?.id) return null;
      try {
         const { data, error } = await supabase
            .from("wordup_async_matches")
            .insert({
               category: effectiveCategory,
               player1_id: user.id,
               player2_id: targetUser.id,
               status: "pending",
               p1_answered: false,
               p2_answered: false,
            })
            .select();
         if (error || !data || data.length === 0) throw error || new Error("Failed to create match");
         const newMatch = data[0];

         const rawQuestions = generateWordUpQuestions(effectiveCategory);
         const secretKey = generateSecretKey();
         const encryptedStr = encryptQuestions(rawQuestions, secretKey);

         const { error: updateError } = await supabase
            .from("wordup_async_matches")
            .update({
               questions: encryptedStr,
               encryption_key: secretKey,
               status: "active",
            })
            .eq("id", newMatch.id);
         if (updateError) throw updateError;

         useAsyncStore.getState().setMatchId(newMatch.id);
         useAsyncStore.getState().setRole("player1");
         triggerToast("Match created! Your opponent will see it in their pending list.", 3000);
         return newMatch.id;
      } catch (e) {
         console.error("Failed to create async match:", e);
         triggerToast("Failed to create match. Try again.", 4000);
         return null;
      }
   }, [user, effectiveCategory, triggerToast]);

   const sendInvite = useCallback(async (targetUser: any, onComplete: (matchId: string | null) => void) => {
      if (!user) return onComplete(null);
      try {
         const channel = supabase.channel(`user_signals_${targetUser.id}`);
         channel.subscribe((status) => {
            if (status === "SUBSCRIBED") {
               channel.send({
                  type: "broadcast",
                  event: "wordup_async_invite",
                  payload: {
                     senderId: user.id,
                     senderName: user.user_metadata?.username || user.email?.split("@")[0] || "Someone",
                     category: effectiveCategory,
                  },
               });
               setTimeout(() => supabase.removeChannel(channel), 1000);
            }
         });
         const mId = await createMatch(targetUser);
         onComplete(mId);
      } catch (e) {
         console.error("Failed to send invite:", e);
         onComplete(null);
      }
   }, [user, effectiveCategory, createMatch]);

   const loadPendingMatches = useCallback(async () => {
      if (!user?.id) return [];
      try {
         const { data, error } = await supabase
            .from("wordup_async_matches")
            .select("*")
            .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
            .in("status", ["pending", "active"])
            .order("created_at", { ascending: false });
         if (error) throw error;
         return data || [];
      } catch (e) {
         console.error("Failed to load pending matches:", e);
         return [];
      }
   }, [user]);

   const loadHistoryMatches = useCallback(async () => {
      if (!user?.id) return [];
      try {
         const { data, error } = await supabase
            .from("wordup_async_matches")
            .select("*")
            .eq("status", "completed")
            .or(`player1_id.eq.${user.id},player2_id.eq.${user.id}`)
            .order("completed_at", { ascending: false })
            .limit(15);
         if (error) throw error;
         return data || [];
      } catch (e) {
         console.error("Failed to load history:", e);
         return [];
      }
   }, [user]);

   return { createMatch, sendInvite, loadPendingMatches, loadHistoryMatches };
};
