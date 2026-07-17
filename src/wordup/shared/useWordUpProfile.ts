import { useState, useCallback, useEffect } from "react";
import { supabase } from "../../lib/supabaseClient";
import { fetchWithRetry } from "../../utils/fetchWithRetry";
import { type ProfileStats } from "./types";
import { RATING, INACTIVITY, RANKS } from "../../constants/wordup";

export const useWordUpProfile = (user: { id: string } | null) => {
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
                  rating: RATING.DEFAULT,
                  xp: 0,
                  games_played: 0,
                  games_won: 0,
                  games_lost: 0,
                  games_tied: 0,
                  rank_name: RANKS.BRONZE.NAME as string
               };
               const { error: insertError } = await supabase
                  .from("wordup_profiles")
                  .insert(defaultProfile);
               if (insertError) throw insertError;
               return defaultProfile;
            }
         }, 3, 1500);

         if (data) {
            const lastUpdate = data.updated_at ? new Date(data.updated_at).getTime() : new Date().getTime();
            const now = new Date().getTime();
            const diffDays = Math.floor((now - lastUpdate) / (1000 * 60 * 60 * 24));
            if (diffDays >= INACTIVITY.THRESHOLD_DAYS && data.games_played > 0) {
               const decayWeeks = Math.floor(diffDays / INACTIVITY.THRESHOLD_DAYS);
               const decayAmount = decayWeeks * INACTIVITY.DECAY_PER_WEEK;
               const newRating = Math.max(RATING.FLOOR, data.rating - decayAmount);

               if (newRating !== data.rating) {
                  let rank: string = RANKS.BRONZE.NAME;
                  if (newRating >= RANKS.MASTER.THRESHOLD) rank = RANKS.MASTER.NAME;
                  else if (newRating >= RANKS.DIAMOND.THRESHOLD) rank = RANKS.DIAMOND.NAME;
                  else if (newRating >= RANKS.GOLD.THRESHOLD) rank = RANKS.GOLD.NAME;
                  else if (newRating >= RANKS.SILVER.THRESHOLD) rank = RANKS.SILVER.NAME;

                  await supabase
                     .from("wordup_profiles")
                     .update({
                        rating: newRating,
                        rank_name: rank,
                        updated_at: new Date().toISOString()
                     })
                     .eq("id", user.id);

                  data.rating = newRating;
                  data.rank_name = rank;
               }
            }
            setUserStats(data);
         }
      } catch (err) {
         console.error("fetchUserProfile failed:", err);
      }
   }, [user]);

   useEffect(() => {
      let active = true;
      const timer = setTimeout(() => {
         if (active) {
            fetchUserProfile();
         }
      }, 0);
      return () => {
         active = false;
         clearTimeout(timer);
      };
   }, [fetchUserProfile]);

   const getRankColor = useCallback((rankName: string) => {
      switch (rankName) {
         case RANKS.MASTER.NAME: return "text-purple-400 border-purple-500/30 bg-purple-500/10";
         case RANKS.DIAMOND.NAME: return "text-cyan-400 border-cyan-500/30 bg-cyan-500/10";
         case RANKS.GOLD.NAME: return "text-yellow-400 border-yellow-500/30 bg-yellow-500/10";
         case RANKS.SILVER.NAME: return "text-slate-300 border-slate-500/30 bg-slate-500/10";
         default: return "text-amber-600 border-amber-600/30 bg-amber-600/10";
      }
   }, []);

   const updateStats = useCallback(async (eloGain: number, xpReward: number, won: boolean, tied: boolean, category?: string | null) => {
      if (!user) return;
      try {
         await (async () => {
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
                     rating: RATING.DEFAULT,
                     xp: 0,
                     games_played: 0,
                     games_won: 0,
                     games_lost: 0,
                     games_tied: 0,
                     rank_name: RANKS.BRONZE.NAME as string
                  };
                  const { error: insertError } = await supabase
                     .from("wordup_profiles")
                     .insert(defaultProfile);
                  if (insertError) throw insertError;
                  return defaultProfile;
               }
            }, 3, 1000);

            if (currentProf) {
               const newRating = Math.max(RATING.FLOOR, currentProf.rating + eloGain);
               const newXp = currentProf.xp + xpReward;

               let rank: string = RANKS.BRONZE.NAME;
               if (newRating >= RANKS.MASTER.THRESHOLD) rank = RANKS.MASTER.NAME;
               else if (newRating >= RANKS.DIAMOND.THRESHOLD) rank = RANKS.DIAMOND.NAME;
               else if (newRating >= RANKS.GOLD.THRESHOLD) rank = RANKS.GOLD.NAME;
               else if (newRating >= RANKS.SILVER.THRESHOLD) rank = RANKS.SILVER.NAME;

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
                        rank_name: rank,
                        updated_at: new Date().toISOString()
                     })
                     .eq("id", user.id);
                  if (error) throw error;
               }, 3, 1000);

               // Category specific profile update
               if (category) {
                  await fetchWithRetry(async () => {
                     const { data: topicProf, error: topicFetchError } = await supabase
                        .from("wordup_category_profiles")
                        .select("*")
                        .eq("user_id", user.id)
                        .eq("category", category)
                        .maybeSingle();
                     if (topicFetchError) throw topicFetchError;

                     const startRating = topicProf ? topicProf.rating : RATING.DEFAULT;
                     const startXp = topicProf ? topicProf.xp : 0;
                     const startPlayed = topicProf ? topicProf.games_played : 0;
                     const startWon = topicProf ? topicProf.games_won : 0;
                     const startLost = topicProf ? topicProf.games_lost : 0;
                     const startTied = topicProf ? topicProf.games_tied : 0;

                     const newTopicRating = Math.max(RATING.FLOOR, startRating + eloGain);
                     const newTopicXp = startXp + xpReward;

                     let topicRank: string = RANKS.BRONZE.NAME;
                     if (newTopicRating >= RANKS.MASTER.THRESHOLD) topicRank = RANKS.MASTER.NAME;
                     else if (newTopicRating >= RANKS.DIAMOND.THRESHOLD) topicRank = RANKS.DIAMOND.NAME;
                     else if (newTopicRating >= RANKS.GOLD.THRESHOLD) topicRank = RANKS.GOLD.NAME;
                     else if (newTopicRating >= RANKS.SILVER.THRESHOLD) topicRank = RANKS.SILVER.NAME;

                     const { error: topicUpsertError } = await supabase
                        .from("wordup_category_profiles")
                        .upsert({
                           user_id: user.id,
                           category: category,
                           rating: newTopicRating,
                           xp: newTopicXp,
                           games_played: startPlayed + 1,
                           games_won: startWon + (won ? 1 : 0),
                           games_lost: startLost + (won || tied ? 0 : 1),
                           games_tied: startTied + (tied ? 1 : 0),
                           rank_name: topicRank,
                           updated_at: new Date().toISOString()
                        }, { onConflict: "user_id,category" });
                     if (topicUpsertError) throw topicUpsertError;
                  }, 3, 1000);
               }

               fetchUserProfile();
            }
         })();
      } catch (err) {
         console.error("Rating update transaction failed:", err);
         throw err;
      }
   }, [user, fetchUserProfile]);

   return { userStats, getRankColor, updateStats, fetchUserProfile };
};
