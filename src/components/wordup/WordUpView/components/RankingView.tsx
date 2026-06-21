import { useEffect, useState, useCallback } from "react";
import { Loader2, Trophy, Medal } from "lucide-react";
import { supabase } from "../../../../lib/supabaseClient";
import { ProtectedAvatar } from "../../../../components/chat/ProtectedAvatar";

import { type ProfileStats } from "../types";

interface LeaderboardEntry extends ProfileStats {
   id: string;
   profiles?: {
      username?: string;
      avatar_url?: string;
   } | null;
}

interface RankingViewProps {
   currentUser: { id: string; user_metadata?: { full_name?: string; avatar_url?: string } } | null;
   userStats: ProfileStats | null;
}

export const RankingView = ({ currentUser, userStats }: RankingViewProps) => {
   const [rankings, setRankings] = useState<LeaderboardEntry[]>([]);
   const [loading, setLoading] = useState(true);
   const [myRankPosition, setMyRankPosition] = useState<number | null>(null);

   const getDecayedRating = useCallback((entry: { updated_at?: string; games_played: number; rating: number }) => {
      const updated = entry.updated_at ? new Date(entry.updated_at).getTime() : new Date().getTime();
      const now = Date.now();
      const diffDays = Math.floor((now - updated) / (1000 * 60 * 60 * 24));
      if (diffDays >= 7 && entry.games_played > 0) {
         const decayWeeks = Math.floor(diffDays / 7);
         return Math.max(600, entry.rating - (decayWeeks * 15));
      }
      return entry.rating;
   }, []);

   const loadLeaderboard = useCallback(async () => {
      setLoading(true);
      try {
         // 1. Fetch top 30 active players
         const { data, error } = await supabase
            .from("wordup_profiles")
            .select(`
               *,
               profiles:id (
                  username,
                  avatar_url
               )
            `)
            .gt("games_played", 0)
            .order("rating", { ascending: false })
            .limit(30);

         if (error) throw error;

         // Resolve decayed ratings for everyone on the fly
         const processed: LeaderboardEntry[] = ((data as any[]) || []).map((entry) => ({
            ...entry,
            rating: getDecayedRating(entry)
         }));

         // Sort again based on resolved decayed ratings
         processed.sort((a, b) => b.rating - a.rating);

         setRankings(processed);

         // 2. If current user is active, find their rank position if not in top 30
         if (currentUser && userStats && userStats.games_played > 0) {
            const inTop30 = processed.some(entry => entry.id === currentUser.id);
            if (!inTop30) {
               const myCurrentDecayedRating = getDecayedRating(userStats);
               const { count, error: countError } = await supabase
                  .from("wordup_profiles")
                  .select("id", { count: "exact", head: true })
                  .gt("games_played", 0)
                  .gt("rating", myCurrentDecayedRating);

               if (!countError && count !== null) {
                  setMyRankPosition(count + 1);
               }
            } else {
               setMyRankPosition(null);
            }
         }
      } catch (err) {
         console.error("[WordUp Logs] Failed to load ranking board:", err);
      } finally {
         setLoading(false);
      }
   }, [currentUser, userStats, getDecayedRating]);

   useEffect(() => {
      let active = true;
      const timer = setTimeout(() => {
         if (active) {
            loadLeaderboard();
         }
      }, 0);
      return () => {
         active = false;
         clearTimeout(timer);
      };
   }, [loadLeaderboard]);

   const getRankIcon = (index: number) => {
      const num = index + 1;
      if (index === 0) return <span className="flex items-center gap-0.5 text-[10px] font-black text-yellow-400">#1<Medal size={13} className="text-yellow-400" /></span>;
      if (index === 1) return <span className="flex items-center gap-0.5 text-[10px] font-black text-slate-300">#2<Medal size={13} className="text-slate-300" /></span>;
      if (index === 2) return <span className="flex items-center gap-0.5 text-[10px] font-black text-amber-600">#3<Medal size={13} className="text-amber-600" /></span>;
      return <span className="text-[10px] text-gray-500 font-black">#{num}</span>;
   };

   const getRankNameColor = (rating: number) => {
      if (rating >= 1700) return "text-purple-400";
      if (rating >= 1400) return "text-cyan-400";
      if (rating >= 1100) return "text-yellow-400";
      if (rating >= 800) return "text-slate-300";
      return "text-gray-500";
   };

   const getRankName = (rating: number) => {
      if (rating >= 1700) return "Master";
      if (rating >= 1400) return "Diamond";
      if (rating >= 1100) return "Gold";
      if (rating >= 800) return "Silver";
      return "Bronze";
   };

   if (loading) {
      return (
         <div className="flex flex-col items-center justify-center py-16 text-gray-400 gap-3">
            <Loader2 className="animate-spin text-correct" size={24} />
            <p className="text-[10px] font-black uppercase tracking-widest animate-pulse">Loading Rankings...</p>
         </div>
      );
   }

   const userInTop30Index = rankings.findIndex(entry => entry.id === currentUser?.id);
   const showSelfBottomCard = currentUser && userStats && userStats.games_played > 0 && userInTop30Index === -1 && myRankPosition !== null;

   return (
      <div className="space-y-4">
         <div className="flex items-center gap-2 px-1">
            <Trophy size={16} className="text-yellow-500" />
            <h3 className="text-xs font-black uppercase tracking-widest text-white">Global Leaderboard</h3>
         </div>

         {/* Rankings Table */}
         <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-xl flex flex-col divide-y divide-white/5">
            {rankings.map((entry, index) => {
               const isMe = entry.id === currentUser?.id;
               const winLossRatio = entry.games_lost === 0
                  ? entry.games_won
                  : parseFloat((entry.games_won / entry.games_lost).toFixed(1));

               return (
                  <div
                     key={entry.id}
                     className={`flex items-center justify-between p-3.5 transition-all ${
                        isMe ? "bg-correct/10" : "hover:bg-white/5"
                     }`}
                  >
                     <div className="flex items-center gap-3 min-w-0">
                        {/* Rank Badge */}
                        <div className="w-8 flex items-center justify-center">
                           {getRankIcon(index)}
                        </div>

                        {/* Avatar */}
                        <ProtectedAvatar
                           userId={entry.id}
                           src={entry.profiles?.avatar_url}
                           username={entry.profiles?.username || "Player"}
                           className="w-7 h-7 rounded-full border border-white/10 shrink-0"
                        />

                        {/* Username & Rank */}
                        <div className="truncate">
                           <p className="text-xs font-black text-white truncate flex items-center gap-1.5">
                              {entry.profiles?.username || "Player"}
                              {isMe && (
                                 <span className="bg-correct text-black text-[8px] font-extrabold px-1 py-0.25 rounded-md shrink-0">YOU</span>
                              )}
                           </p>
                           <p className={`text-[8px] font-black uppercase tracking-wider ${getRankNameColor(entry.rating)}`}>
                              {getRankName(entry.rating)}
                           </p>
                        </div>
                     </div>

                     {/* Stats */}
                     <div className="flex items-center gap-6 shrink-0 text-right">
                        <div>
                           <p className="text-[9px] text-gray-500 font-bold uppercase">W / L</p>
                           <p className="text-xs font-black text-white">
                              {entry.games_won}<span className="text-gray-500 text-[10px]">/</span><span className="text-red-400/90">{entry.games_lost}</span>
                              <span className="text-[9px] text-gray-500 font-bold ml-1">({winLossRatio})</span>
                           </p>
                        </div>
                        <div className="w-16">
                           <p className="text-[9px] text-gray-500 font-bold uppercase">Rating</p>
                           <p className="text-xs font-black text-correct">{entry.rating} ELO</p>
                        </div>
                     </div>
                  </div>
               );
            })}

            {/* Self Hoisted Bottom Row */}
            {showSelfBottomCard && (
               <div
                  className="flex items-center justify-between p-3.5 bg-correct/10"
                  style={{ borderTop: "1px dashed rgba(255, 255, 255, 0.25)" }}
               >
                  <div className="flex items-center gap-3 min-w-0">
                     {/* Rank Badge */}
                     <div className="w-8 flex items-center justify-center">
                        <span className="text-[10px] text-correct font-black">#{myRankPosition}</span>
                     </div>

                     {/* Avatar */}
                     <ProtectedAvatar
                        userId={currentUser?.id}
                        src={currentUser?.user_metadata?.avatar_url}
                        username={currentUser?.user_metadata?.full_name || "You"}
                        className="w-7 h-7 rounded-full border border-correct/30 shrink-0"
                     />

                     {/* Username & Rank */}
                     <div className="truncate">
                        <p className="text-xs font-black text-white truncate flex items-center gap-1.5">
                           {currentUser?.user_metadata?.full_name || "You"}
                           <span className="bg-correct text-black text-[8px] font-extrabold px-1 py-0.25 rounded-md shrink-0">YOU</span>
                        </p>
                        <p className={`text-[8px] font-black uppercase tracking-wider ${getRankNameColor(getDecayedRating(userStats))}`}>
                           {getRankName(getDecayedRating(userStats))}
                        </p>
                     </div>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center gap-6 shrink-0 text-right">
                     <div>
                        <p className="text-[9px] text-gray-500 font-bold uppercase">W / L</p>
                        <p className="text-xs font-black text-white">
                           {userStats.games_won}<span className="text-gray-500 text-[10px]">/</span><span className="text-red-400/90">{userStats.games_lost}</span>
                           <span className="text-[9px] text-gray-500 font-bold ml-1">
                              ({userStats.games_lost === 0 ? userStats.games_won : parseFloat((userStats.games_won / userStats.games_lost).toFixed(1))})
                           </span>
                        </p>
                     </div>
                     <div className="w-16">
                        <p className="text-[9px] text-gray-500 font-bold uppercase">Rating</p>
                        <p className="text-xs font-black text-correct">{getDecayedRating(userStats)} ELO</p>
                     </div>
                  </div>
               </div>
            )}

            {rankings.length === 0 && (
               <div className="text-center py-12 text-gray-500 text-xs font-bold uppercase tracking-wider">
                  No active rankings found yet.
               </div>
            )}
         </div>
      </div>
   );
};
