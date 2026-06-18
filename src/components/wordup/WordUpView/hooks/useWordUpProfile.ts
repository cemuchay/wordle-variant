import { useState, useCallback, useEffect } from "react";
import { supabase } from "../../../../lib/supabaseClient";
import { fetchWithRetry } from "../../../../utils/fetchWithRetry";
import { type ProfileStats } from "../types";

export const useWordUpProfile = (user: any) => {
   const [userStats, setUserStats] = useState<ProfileStats | null>(null);

   const fetchUserProfile = useCallback(async () => {
      if (!user) return;
      try {
         const data = await fetchWithRetry(async () => {
            const { data, error } = await supabase
               .from("wordup_profiles")
               .select("*")
               .eq("id", user.id)
               .maybeSingle();
            if (error) throw error;
            
            if (data) {
               return data;
            } else {
               const defaultProfile = {
                  id: user.id,
                  rating: 1000,
                  xp: 0,
                  games_played: 0,
                  games_won: 0,
                  games_lost: 0,
                  games_tied: 0,
                  rank_name: "Silver"
               };
               const { error: insertError } = await supabase
                  .from("wordup_profiles")
                  .insert(defaultProfile);
               if (insertError) throw insertError;
               return defaultProfile;
            }
         }, 3, 1500);

         if (data) {
            setUserStats(data);
         }
      } catch (err) {
         console.error("fetchUserProfile failed:", err);
      }
   }, [user]);

   useEffect(() => {
      fetchUserProfile();
   }, [fetchUserProfile]);

   const getRankColor = useCallback((rankName: string) => {
      switch (rankName) {
         case "Master": return "text-purple-400 border-purple-500/30 bg-purple-500/10";
         case "Diamond": return "text-cyan-400 border-cyan-500/30 bg-cyan-500/10";
         case "Gold": return "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";
         case "Silver": return "text-slate-300 border-slate-500/30 bg-slate-500/10";
         default: return "text-amber-600 border-amber-600/30 bg-amber-600/10";
      }
   }, []);

   const updateStats = useCallback(async (eloGain: number, xpReward: number, won: boolean, tied: boolean) => {
      if (!user) return;
      try {
         const currentProf = await fetchWithRetry(async () => {
            const { data, error } = await supabase
               .from("wordup_profiles")
               .select("*")
               .eq("id", user.id)
               .maybeSingle();
            if (error) throw error;
            if (data) {
               return data;
            } else {
               const defaultProfile = {
                  id: user.id,
                  rating: 1000,
                  xp: 0,
                  games_played: 0,
                  games_won: 0,
                  games_lost: 0,
                  games_tied: 0,
                  rank_name: "Silver"
               };
               const { error: insertError } = await supabase
                  .from("wordup_profiles")
                  .insert(defaultProfile);
               if (insertError) throw insertError;
               return defaultProfile;
            }
         }, 3, 1000);

         if (currentProf) {
            const newRating = Math.max(800, currentProf.rating + eloGain);
            const newXp = currentProf.xp + xpReward;

            let rank = "Bronze";
            if (newRating >= 1800) rank = "Master";
            else if (newRating >= 1500) rank = "Diamond";
            else if (newRating >= 1200) rank = "Gold";
            else if (newRating >= 1000) rank = "Silver";

            await fetchWithRetry(async () => {
               const { error } = await supabase
                  .from("wordup_profiles")
                  .update({
                     rating: newRating,
                     xp: newXp,
                     games_played: currentProf.games_played + 1,
                     games_won: currentProf.games_won + (won ? 1 : 0),
                     games_lost: currentProf.games_lost + (won || tied ? 0 : 1),
                     games_tied: currentProf.games_tied + (tied ? 1 : 0),
                     rank_name: rank
                  })
                  .eq("id", user.id);
               if (error) throw error;
            }, 3, 1000);

            fetchUserProfile();
         }
      } catch (err) {
         console.error("Rating update transaction failed:", err);
         throw err;
      }
   }, [user, fetchUserProfile]);

   return { userStats, getRankColor, updateStats, fetchUserProfile };
};
