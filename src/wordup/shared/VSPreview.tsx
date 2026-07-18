/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Swords, Trophy, Activity, Loader2 } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import { ProtectedAvatar } from "../../components/chat/ProtectedAvatar";
import { BOT_PROFILES } from "../../utils/wordupQuestionGenerator";
import { BOT_PROFILES_RATINGS } from "../../constants/wordup";
import { CATEGORIES } from "./constants";
import { CATEGORY_STYLE_MAP, DEFAULT_STYLE } from "./categorySelectConstants";

interface VSPreviewProps {
   currentUser: any;
   opponentStats: any;
   matchData: any;
   categoryId: string;
   getRankColor: (rankName: string) => string;
   onCancel?: () => void;
   message?: string;
}

export const VSPreview = ({
   currentUser,
   opponentStats,
   matchData,
   categoryId,
   getRankColor,
   onCancel,
   message,
}: VSPreviewProps) => {
   const [myForm, setMyForm] = useState<string[]>(["W", "W", "L", "W", "W"]);
   const [oppForm, setOppForm] = useState<string[]>(["W", "L", "W", "L", "W"]);
   const [myCategoryStats, setMyCategoryStats] = useState<any>(null);
   const [oppCategoryStats, setOppCategoryStats] = useState<any>(null);

   useEffect(() => {
      let active = true;
      if (!currentUser) return;

      const fetchPlayerDetails = async () => {
         // 1. Fetch category-specific stats/ELO
         try {
            if (categoryId === "mixed") {
               // Fallback to global statistics if mixed
               const { data: globalMe } = await supabase
                  .from("wordup_profiles")
                  .select("rating, rank_name")
                  .eq("user_id", currentUser.id)
                  .maybeSingle();
               if (globalMe && active) setMyCategoryStats(globalMe);
            } else {
               const { data: catMe } = await supabase
                  .from("wordup_category_profiles")
                  .select("rating, rank_name")
                  .eq("user_id", currentUser.id)
                  .eq("category", categoryId)
                  .maybeSingle();
               if (catMe && active) setMyCategoryStats(catMe);
            }
         } catch (e) {
            console.warn("Failed to fetch category stats for current user:", e);
         }

         // 2. Fetch category-specific stats for Opponent
         if (matchData?.is_bot_match) {
            setOppCategoryStats({
               rating: 800,
               rank_name: "Gold"
            });
         } else if (opponentStats?.id) {
            try {
               if (categoryId === "mixed") {
                  const { data: globalOpp } = await supabase
                     .from("wordup_profiles")
                     .select("rating, rank_name")
                     .eq("id", opponentStats.id)
                     .maybeSingle();
                  if (globalOpp && active) setOppCategoryStats(globalOpp);
               } else {
                  const { data: catOpp } = await supabase
                     .from("wordup_category_profiles")
                     .select("rating, rank_name")
                     .eq("user_id", opponentStats.id)
                     .eq("category", categoryId)
                     .maybeSingle();
                  if (catOpp && active) setOppCategoryStats(catOpp);
               }
            } catch (e) {
               console.warn("Failed to fetch category stats for opponent:", e);
            }
         }

         // 3. Fetch recent matches for form (last 5 games)
         const getForm = async (uid: string) => {
            try {
               const { data } = await supabase
                  .from("wordup_matches")
                  .select("player1_id, player2_id, p1_score, p2_score")
                  .eq("status", "completed")
                  .or(`player1_id.eq.${uid},player2_id.eq.${uid}`)
                  .order("completed_at", { ascending: false })
                  .limit(5);

               if (!data || data.length === 0) return ["W", "W", "D", "L", "W"];

               return data.map((m) => {
                  const isP1 = m.player1_id === uid;
                  const myScore = isP1 ? m.p1_score || 0 : m.p2_score || 0;
                  const oppScore = isP1 ? m.p2_score || 0 : m.p1_score || 0;
                  if (myScore > oppScore) return "W";
                  if (myScore < oppScore) return "L";
                  return "D";
               });
            } catch {
               return ["W", "W", "D", "L", "W"];
            }
         };

         const myRecentForm = await getForm(currentUser.id);
         if (active) setMyForm(myRecentForm);

         if (matchData?.is_bot_match) {
            if (active) setOppForm(["W", "L", "W", "W", "L"]);
         } else if (opponentStats?.id) {
            const oppRecentForm = await getForm(opponentStats.id);
            if (active) setOppForm(oppRecentForm);
         }
      };

      fetchPlayerDetails();

      return () => {
         active = false;
      };
   }, [currentUser, opponentStats?.id, matchData?.is_bot_match, categoryId]);

   const myName = currentUser?.user_metadata?.username || currentUser?.user_metadata?.full_name || "You";
   const myRating = myCategoryStats?.rating ?? 600;
   const myRank = myCategoryStats?.rank_name ?? "Bronze";

   const isBot = matchData?.is_bot_match;
   const botProfileKey = matchData?.bot_profile;

   const oppName = isBot
      ? (BOT_PROFILES[botProfileKey]?.name || "Word Bot")
      : opponentStats?.username || "Opponent";

   const getBotRank = (rating: number) => {
      return rating >= 1700 ? "Master" : rating >= 1400 ? "Diamond" : rating >= 1100 ? "Gold" : rating >= 800 ? "Silver" : "Bronze";
   };

   const oppRating = isBot
      ? (BOT_PROFILES_RATINGS[botProfileKey] || 1000)
      : oppCategoryStats?.rating ?? (opponentStats?.rating || 600);

   const oppRank = isBot
      ? getBotRank(oppRating)
      : oppCategoryStats?.rank_name ?? (opponentStats?.rank_name || "Bronze");

   const myAvatarUrl = currentUser?.user_metadata?.avatar_url;
   const oppAvatarUrl = matchData?.is_bot_match
      ? `https://api.dicebear.com/7.x/bottts/svg?seed=${matchData.bot_profile || "average"}`
      : opponentStats?.avatar_url;

   const getFormColor = (f: string) => {
      if (f === "W") return "bg-correct text-black";
      if (f === "L") return "bg-red-500 text-white";
      return "bg-white/20 text-white";
   };

   const categoryObj = CATEGORIES.find(c => c.id === categoryId) || CATEGORIES[0];
   const catStyle = CATEGORY_STYLE_MAP[categoryObj.id] || DEFAULT_STYLE;

   return (
      <motion.div
         initial={{ opacity: 0 }}
         animate={{ opacity: 1 }}
         exit={{ opacity: 0 }}
         className="flex flex-col flex-1 min-h-[460px] relative overflow-hidden bg-[#121212] select-none rounded-3xl border border-white/10"
      >
         {/* Category Label Pill */}
         <div className="pt-4 px-5 flex flex-col items-center z-10 shrink-0">
            <span className="text-[9px] font-black uppercase tracking-widest text-[#E85151]">Match Category</span>
            <div className="flex items-center gap-1.5 mt-1 bg-white/5 border border-white/10 px-3 py-1 rounded-full">
               <span className="text-xs">{catStyle.emoji}</span>
               <span className="text-xs font-black uppercase text-white tracking-wider">{categoryObj.name}</span>
            </div>
         </div>

         {/* Top Half: Player 1 (You) */}
         <div className="flex-1 flex flex-col items-center justify-center p-5 bg-linear-to-b from-[#E85151]/10 to-[#121212] relative">
            <motion.div
               initial={{ y: -20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               transition={{ delay: 0.1 }}
               className="flex flex-col items-center text-center space-y-2.5"
            >
               <div className="w-16 h-16 rounded-full border-2 border-[#E85151] overflow-hidden bg-black/40 flex items-center justify-center shadow-lg shadow-[#E85151]/20">
                  <ProtectedAvatar
                     userId={currentUser?.id}
                     src={myAvatarUrl}
                     username={myName}
                     className="w-full h-full"
                  />
               </div>
               <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">{myName}</h3>
                  <div className="flex items-center gap-1.5 justify-center mt-1">
                     <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md border ${getRankColor(myRank)}`}>
                        {myRank}
                     </span>
                     <span className="text-[10px] text-white/90 font-black flex items-center gap-0.5">
                        <Trophy size={11} className="text-yellow-500" />
                        {myRating} ELO
                     </span>
                  </div>
               </div>

               {/* Form */}
               <div className="flex items-center gap-1 mt-1">
                  <span className="text-[8px] font-black text-white/50 uppercase mr-1 flex items-center gap-0.5">
                     <Activity size={9} /> Form:
                  </span>
                  {myForm.map((f, i) => (
                     <span
                        key={i}
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black ${getFormColor(f)}`}
                     >
                        {f}
                     </span>
                  ))}
               </div>
            </motion.div>
         </div>

         {/* Middle Splitter Badge */}
         <div className="relative h-12 flex items-center justify-center z-10">
            <div className="absolute w-full h-px bg-white/10" />
            <motion.div
               initial={{ scale: 0 }}
               animate={{ scale: 1 }}
               transition={{ type: "spring", stiffness: 200, damping: 15 }}
               className="w-12 h-12 rounded-full bg-[#E85151] border-2 border-[#121212] flex items-center justify-center text-white font-black shadow-lg shadow-[#E85151]/30 relative"
            >
               <Swords size={18} className="stroke-3 animate-pulse" />
               {/* Pulse Ring */}
               <div className="absolute -inset-1 rounded-full border border-[#E85151]/40 animate-ping opacity-45" />
            </motion.div>
         </div>

         {/* Bottom Half: Player 2 (Opponent / Bot) */}
         <div className="flex-1 flex flex-col items-center justify-center p-5 bg-linear-to-t from-[#E85151]/5 to-[#121212] relative">
            <motion.div
               initial={{ y: 20, opacity: 0 }}
               animate={{ y: 0, opacity: 1 }}
               transition={{ delay: 0.2 }}
               className="flex flex-col items-center text-center space-y-2.5"
            >
               <div className="w-16 h-16 rounded-full border-2 border-white/20 overflow-hidden bg-black/40 flex items-center justify-center shadow-lg">
                  <ProtectedAvatar
                     userId={matchData?.is_bot_match ? undefined : opponentStats?.id}
                     src={oppAvatarUrl}
                     username={oppName}
                     className="w-full h-full"
                  />
               </div>
               <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">{oppName}</h3>
                  <div className="flex items-center gap-1.5 justify-center mt-1">
                     <span className={`text-[8.5px] font-black uppercase px-2 py-0.5 rounded-md border ${getRankColor(oppRank)}`}>
                        {oppRank}
                     </span>
                     <span className="text-[10px] text-white/90 font-black flex items-center gap-0.5">
                        <Trophy size={11} className="text-yellow-500" />
                        {oppRating} ELO
                     </span>
                  </div>
               </div>

               {/* Form */}
               <div className="flex items-center gap-1 mt-1">
                  <span className="text-[8px] font-black text-white/50 uppercase mr-1 flex items-center gap-0.5">
                     <Activity size={9} /> Form:
                  </span>
                  {oppForm.map((f, i) => (
                     <span
                        key={i}
                        className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black ${getFormColor(f)}`}
                     >
                        {f}
                     </span>
                  ))}
               </div>
            </motion.div>
         </div>

         {/* Bottom Loading Bar indicator */}
         <div className="px-5 pb-5 pt-2 flex flex-col items-center gap-2.5">
            <div className="flex items-center gap-2 text-white/70">
               <Loader2 size={13} className="text-[#E85151] animate-spin" />
               <span className="text-[9px] font-black uppercase tracking-widest animate-pulse">
                  {message || "Loading Arena Questions..."}
               </span>
            </div>
            {onCancel && (
               <button
                  onClick={onCancel}
                  className="bg-white/5 hover:bg-white/10 border border-white/10 text-white/80 px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
               >
                  Cancel Match
               </button>
            )}
         </div>
      </motion.div>
   );
};

export default VSPreview;
