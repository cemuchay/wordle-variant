/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, Shield, Play, HelpCircle, ChevronDown, ChevronUp, Clock, Flame } from "lucide-react";
import { CATEGORIES } from "../shared/constants";
import { CATEGORY_STYLE_MAP, DEFAULT_STYLE, loadRecents } from "../shared/categorySelectConstants";
import { type ProfileStats } from "../shared/types";
import { supabase } from "../../lib/supabaseClient";
import { TopicDetailsView } from "./TopicDetailsView";
import formatUsername from "../../utils/formatUsername";
import { ProtectedAvatar } from "../../components/chat/ProtectedAvatar";

interface UnifiedLobbyProps {
   userStats: ProfileStats | null;
   getRankColor: (rankName: string) => string;
   allProfiles: any[];
   currentUser: any;
   onSelectHistoryMatch?: (match: any) => void;
   soundEnabled: boolean;
   onToggleSound: () => void;
   onPlayLiveCategory: (catId: string) => void;
   onPlayAsyncChallenge: (targetUser: any, catId: string) => void;
   onPlayAsyncTurn: (match: any) => void;
   pendingMatches: any[];
   onRefreshPending: () => void;
    onBackToClassic?: () => void;
    onTutorial?: () => void;
    onNavigateLive?: () => void;
    onNavigateAsync?: () => void;
}

export const UnifiedLobby = ({
    userStats,
    getRankColor,
    allProfiles,
    currentUser,
    onSelectHistoryMatch,
    onPlayLiveCategory,
    onPlayAsyncChallenge,
    onPlayAsyncTurn,
    pendingMatches,
    onRefreshPending,
    onBackToClassic,
    onTutorial,
    onNavigateLive,
    onNavigateAsync,
}: UnifiedLobbyProps) => {
   const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
   const [historyMatches, setHistoryMatches] = useState<any[]>([]);
   const [showHelp, setShowHelp] = useState(false);
   const [recentCategoryIds, setRecentCategoryIds] = useState<string[]>([]);

   // Load frequently used categories on mount
   useEffect(() => {
      setRecentCategoryIds(loadRecents());
   }, [selectedCategoryId]);

   // Fetch recent completed live matches
   const fetchLiveHistory = useCallback(async () => {
      if (!currentUser) return;
      try {
         const { data, error } = await supabase
            .from("wordup_matches")
            .select(`
               *,
               player1:player1_id (username, avatar_url),
               player2:player2_id (username, avatar_url)
            `)
            .eq("status", "completed")
            .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id}`)
            .order("completed_at", { ascending: false })
            .limit(5);

         if (!error && data) {
            setHistoryMatches(data);
         }
      } catch (e) {
         console.error("Failed to fetch match history:", e);
      }
   }, [currentUser]);

   useEffect(() => {
      fetchLiveHistory();
      onRefreshPending();
   }, [fetchLiveHistory, onRefreshPending]);

   // Smart Activity/News Feed builder
   const buildActivityFeed = () => {
      const feedItems: any[] = [];

      // 1. Add active async challenges (Your Turn / Opponent Turn)
      (pendingMatches || []).forEach((match) => {
         const isP1 = match.player1_id === currentUser?.id;
         const oppProfile = isP1 ? match.player2 : match.player1;
         const oppName = oppProfile?.username || "Opponent";
         const hasPlayed = isP1 ? match.p1_answered : match.p2_answered;
         const myTurn = !hasPlayed;

         feedItems.push({
            id: `async-${match.id}`,
            type: "async_challenge",
            timestamp: new Date(match.created_at).getTime(),
            data: match,
            myTurn,
            oppName,
            category: match.category,
         });
      });

      // 2. Add recent completed matches
      historyMatches.forEach((match) => {
         const isP1 = match.player1_id === currentUser?.id;
         const oppProfile = isP1 ? match.player2 : match.player1;
         const oppName = match.is_bot_match ? "Word Bot" : (oppProfile?.username || "Opponent");
         const myScore = isP1 ? match.p1_score || 0 : match.p2_score || 0;
         const oppScore = isP1 ? match.p2_score || 0 : match.p1_score || 0;
         const won = myScore > oppScore;
         const draw = myScore === oppScore;

         feedItems.push({
            id: `history-${match.id}`,
            type: "completed_match",
            timestamp: new Date(match.completed_at || match.created_at).getTime(),
            data: match,
            oppName,
            myScore,
            oppScore,
            won,
            draw,
            category: match.category,
         });
      });

      // 3. Add Rank milestones
      if (userStats) {
         feedItems.push({
            id: `rank-milestone-${userStats.rank_name}`,
            type: "rank_milestone",
            timestamp: new Date().getTime() - 1000, // Show right at top
            rankName: userStats.rank_name,
            rating: userStats.rating,
         });
      }

      // Sort chronological (newest first)
      return feedItems.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
   };

   const activityFeed = buildActivityFeed();

   if (selectedCategoryId) {
      return (
         <TopicDetailsView
            categoryId={selectedCategoryId}
            onBack={() => setSelectedCategoryId(null)}
            currentUser={currentUser}
            userStats={userStats}
            getRankColor={getRankColor}
            allProfiles={allProfiles}
            onPlayLive={() => onPlayLiveCategory(selectedCategoryId)}
            onChallengePlayer={(targetUser) => onPlayAsyncChallenge(targetUser, selectedCategoryId)}
         />
      );
   }

   // Categories classification
   const featuredCategories = CATEGORIES.filter((c) => c.featured);
   const frequentCategories = CATEGORIES.filter((c) => recentCategoryIds.includes(c.id));
   const allCategories = CATEGORIES;

   return (
      <motion.div
         initial={{ opacity: 0, y: 15 }}
         animate={{ opacity: 1, y: 0 }}
         exit={{ opacity: 0, y: -15 }}
         className="flex flex-col gap-4 flex-1 bg-[#121212] text-white py-1 md:py-2 select-none min-h-0 overflow-y-auto scrollbar-hide px-4"
      >
         {/* Top Header / Brand Bar */}
         <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 rounded-xl bg-[#ff4b5c] flex items-center justify-center text-white shadow-md shadow-[#ff4b5c]/35">
                  <Play size={16} fill="white" />
               </div>
               <h1 className="text-xl font-black uppercase tracking-wider text-white">WordUp Arena</h1>
            </div>
            {onTutorial && (
               <button
                  onClick={onTutorial}
                  className="bg-white/5 hover:bg-white/10 border border-white/15 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-[#ff4b5c] cursor-pointer"
               >
                  Tutorial
               </button>
            )}
         </div>

         {/* Profile summary card */}
         {userStats && (
            <div className="relative overflow-hidden bg-gradient-to-r from-[#ff4b5c]/15 to-[#ff4b5c]/5 border border-[#ff4b5c]/20 rounded-2xl p-4 flex items-center justify-between shadow-md">
               <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full border-2 border-[#ff4b5c] overflow-hidden flex items-center justify-center bg-black/40">
                     <ProtectedAvatar
                        userId={currentUser?.id}
                        src={currentUser?.user_metadata?.avatar_url}
                        username={formatUsername(currentUser?.user_metadata?.full_name)}
                        className="w-full h-full"
                     />
                  </div>
                  <div>
                     <h3 className="text-sm font-black text-white leading-none mb-1">
                        {formatUsername(currentUser?.user_metadata?.full_name) || "Player"}
                     </h3>
                     <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md border ${getRankColor(userStats.rank_name)}`}>
                        {userStats.rank_name}
                     </span>
                  </div>
               </div>
               <div className="text-right">
                  <p className="text-[9px] text-gray-500 font-black uppercase">ELO rating</p>
                  <p className="text-lg font-black text-white flex items-center gap-1 justify-end">
                     <Flame size={16} fill="#ff4b5c" className="text-[#ff4b5c]" />
                     {userStats.rating}
                  </p>
               </div>
            </div>
         )}

         {/* Smart News / Activity Feed */}
         <div className="space-y-2">
            <div className="flex items-center gap-1.5 text-gray-500">
               <Radio size={14} className="text-[#ff4b5c] animate-pulse" />
               <span className="text-[10px] font-black uppercase tracking-wider">Latest Activity Feed</span>
            </div>

            <div className="space-y-2 bg-[#181818] border border-white/5 p-3 rounded-2xl shadow-inner min-h-[100px]">
               {activityFeed.length > 0 ? (
                  activityFeed.map((item) => {
                     const catObj = CATEGORIES.find(c => c.id === item.category);
                     const emoji = CATEGORY_STYLE_MAP[item.category]?.emoji || "💡";

                     if (item.type === "async_challenge") {
                        return (
                           <div key={item.id} className="flex items-center justify-between bg-black/35 border border-white/5 rounded-xl p-2.5">
                              <div className="flex items-center gap-2">
                                 <span className="text-lg">{emoji}</span>
                                 <div className="min-w-0">
                                    <p className="text-[11px] text-white font-bold leading-tight truncate">
                                       Challenge vs <span className="text-[#ff4b5c]">{item.oppName}</span>
                                    </p>
                                    <p className="text-[8px] text-gray-500 font-extrabold uppercase mt-0.5">
                                       {catObj?.name || "Trivia"}
                                    </p>
                                 </div>
                              </div>
                              {item.myTurn ? (
                                 <button
                                    onClick={() => onPlayAsyncTurn(item.data)}
                                    className="bg-[#ff4b5c] hover:bg-[#ff3548] text-white text-[8px] font-black uppercase tracking-widest px-2.5 py-1.5 rounded-lg shadow cursor-pointer transition-all active:scale-95"
                                 >
                                    Play Turn
                                 </button>
                              ) : (
                                 <span className="text-[7.5px] font-black uppercase text-yellow-500 bg-yellow-500/10 border border-yellow-500/20 px-2 py-1 rounded-md shrink-0">
                                    Waiting
                                 </span>
                              )}
                           </div>
                        );
                     }

                     if (item.type === "completed_match") {
                        let outcome = "DRAW";
                        let outcomeStyle = "text-gray-400 border-white/10 bg-white/5";
                        if (item.won) {
                           outcome = "WIN";
                           outcomeStyle = "text-[#ff4b5c] border-[#ff4b5c]/20 bg-[#ff4b5c]/10";
                        } else if (!item.draw) {
                           outcome = "LOSS";
                           outcomeStyle = "text-red-400 border-red-500/10 bg-red-500/10";
                        }

                        return (
                           <div
                              key={item.id}
                              onClick={() => onSelectHistoryMatch?.(item.data)}
                              className="flex items-center justify-between bg-black/20 border border-white/5 rounded-xl p-2.5 hover:bg-white/5 cursor-pointer transition-all"
                           >
                              <div className="flex items-center gap-2 min-w-0">
                                 <span className="text-lg">{emoji}</span>
                                 <div className="min-w-0">
                                    <p className="text-[11px] text-white font-bold leading-tight truncate">
                                       vs {item.oppName}
                                    </p>
                                    <p className="text-[8px] text-gray-500 font-extrabold uppercase mt-0.5">
                                       {catObj?.name || "Trivia"}
                                    </p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                 <span className="text-[10px] font-black text-white">{item.myScore} - {item.oppScore}</span>
                                 <span className={`text-[7.5px] font-black uppercase px-2 py-0.5 rounded-md border ${outcomeStyle}`}>
                                    {outcome}
                                 </span>
                              </div>
                           </div>
                        );
                     }

                     if (item.type === "rank_milestone") {
                        return (
                           <div key={item.id} className="flex items-center gap-2.5 bg-[#ff4b5c]/10 border border-[#ff4b5c]/25 rounded-xl p-2.5">
                              <Shield size={16} className="text-[#ff4b5c]" />
                              <div>
                                 <p className="text-[11px] text-white font-bold leading-tight">
                                    Rank Update: <span className="text-[#ff4b5c]">{item.rankName}</span>
                                 </p>
                                 <p className="text-[8px] text-gray-500 font-extrabold uppercase mt-0.5">
                                    Currently holding {item.rating} rating ELO
                                 </p>
                              </div>
                           </div>
                        );
                     }

                     return null;
                  })
               ) : (
                  <div className="text-center py-6 text-gray-500 text-[10px] font-black uppercase tracking-wider">
                     No recent matches or activities.
                  </div>
               )}
            </div>
         </div>

         {/* Frequently Used Topics */}
         {frequentCategories.length > 0 && (
            <div className="space-y-2">
               <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Frequently Played</p>
               <div className="grid grid-cols-2 gap-2">
                  {frequentCategories.slice(0, 4).map((cat) => {
                     const style = CATEGORY_STYLE_MAP[cat.id] || DEFAULT_STYLE;
                     return (
                        <div
                           key={cat.id}
                           onClick={() => setSelectedCategoryId(cat.id)}
                           className="bg-[#181818] hover:bg-[#202020] border border-white/5 rounded-2xl p-3 flex items-center gap-2.5 cursor-pointer transition-all active:scale-98 shadow-md"
                        >
                           <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xl shrink-0">
                              {style.emoji}
                           </div>
                           <div className="min-w-0">
                              <p className="text-xs font-black text-white truncate uppercase tracking-wider leading-none mb-1">{cat.name}</p>
                              <p className="text-[8px] text-[#ff4b5c] font-black uppercase tracking-widest">Select Topic</p>
                           </div>
                        </div>
                     );
                  })}
               </div>
            </div>
         )}

         {/* Featured Topics */}
         <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Featured Topics</p>
            <div className="grid grid-cols-2 gap-2">
               {featuredCategories.slice(0, 4).map((cat) => {
                  const style = CATEGORY_STYLE_MAP[cat.id] || DEFAULT_STYLE;
                  return (
                     <div
                        key={cat.id}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className="bg-[#181818] hover:bg-[#202020] border border-white/5 rounded-2xl p-3 flex items-center gap-2.5 cursor-pointer transition-all active:scale-98 shadow-md"
                     >
                        <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xl shrink-0">
                           {style.emoji}
                        </div>
                        <div className="min-w-0">
                           <p className="text-xs font-black text-white truncate uppercase tracking-wider leading-none mb-1">{cat.name}</p>
                           <p className="text-[8px] text-[#ff4b5c] font-black uppercase tracking-widest">Play Topic</p>
                        </div>
                     </div>
                  );
               })}
            </div>
         </div>

         {/* All Topics */}
         <div className="space-y-2">
            <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">All Topics</p>
            <div className="grid grid-cols-2 gap-2">
               {allCategories.map((cat) => {
                  const style = CATEGORY_STYLE_MAP[cat.id] || DEFAULT_STYLE;
                  return (
                     <div
                        key={cat.id}
                        onClick={() => setSelectedCategoryId(cat.id)}
                        className="bg-[#181818] hover:bg-[#202020] border border-white/5 rounded-2xl p-3 flex items-center gap-2.5 cursor-pointer transition-all active:scale-98 shadow-md"
                     >
                        <div className="w-9 h-9 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xl shrink-0">
                           {style.emoji}
                        </div>
                        <div className="min-w-0">
                           <p className="text-xs font-black text-white truncate uppercase tracking-wider leading-none mb-1">{cat.name}</p>
                           <p className="text-[8px] text-gray-500 font-extrabold uppercase tracking-widest">Details</p>
                        </div>
                     </div>
                  );
               })}
            </div>
         </div>

         {/* How to Play Help Section */}
         <div className="bg-[#181818] border border-white/5 rounded-2xl overflow-hidden transition-all duration-300">
            <button
               onClick={() => setShowHelp(!showHelp)}
               className="w-full flex items-center justify-between p-4 text-xs font-black uppercase tracking-wider text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
               <div className="flex items-center gap-2">
                  <HelpCircle size={14} className="text-[#ff4b5c]" />
                  <span>How to Play & Scoring</span>
               </div>
               {showHelp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            <AnimatePresence initial={false}>
               {showHelp && (
                  <motion.div
                     initial={{ opacity: 0, height: 0 }}
                     animate={{ opacity: 1, height: "auto" }}
                     exit={{ opacity: 0, height: 0 }}
                     transition={{ duration: 0.2 }}
                     className="px-4 pb-5 text-[11px] text-gray-400 space-y-4 border-t border-white/5 pt-4 overflow-hidden"
                  >
                     <div>
                        <p className="font-black text-white uppercase tracking-wider mb-1">Game Flow</p>
                        <p>You and your opponent answer the same 7 questions. Play live in real-time or challenge your friends asynchronously at your own pace.</p>
                     </div>
                     <div>
                        <p className="font-black text-white uppercase tracking-wider mb-1">Scoring System</p>
                        <ul className="list-disc pl-4 space-y-1">
                           <li><strong className="text-[#ff4b5c]">Correct answer</strong>: <strong className="text-white">11–20 points</strong> (decays based on speed).</li>
                           <li><strong className="text-pink-500">Round 7 (Final Round)</strong>: All points are <strong className="text-pink-500">DOUBLED</strong>!</li>
                        </ul>
                     </div>
                  </motion.div>
               )}
            </AnimatePresence>
         </div>

          {/* Footer Nav */}
          <div className="mt-4 pt-4 border-t border-white/5 mb-2 space-y-2">
             <p className="text-[9px] font-black uppercase tracking-widest text-gray-500 mb-2.5 px-0.5">
                Game Modes
             </p>
             {(onNavigateLive || onNavigateAsync) && (
                <div className="grid grid-cols-2 gap-2">
                   {onNavigateLive && (
                      <button
                         onClick={onNavigateLive}
                         className="flex items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer group"
                      >
                         <div className="p-1.5 rounded-lg bg-correct/10 border border-correct/20 text-correct">
                            <Radio size={14} />
                         </div>
                         <span className="text-xs font-black text-white group-hover:text-correct transition-colors">
                            Live Arena
                         </span>
                      </button>
                   )}
                   {onNavigateAsync && (
                      <button
                         onClick={onNavigateAsync}
                         className="flex items-center gap-2 p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer group"
                      >
                         <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                            <Shield size={14} />
                         </div>
                         <span className="text-xs font-black text-white group-hover:text-indigo-400 transition-colors">
                            1v1 Arena
                         </span>
                      </button>
                   )}
                </div>
             )}
             {onBackToClassic && (
                <button
                   onClick={onBackToClassic}
                   className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer group"
                >
                   <div className="flex-1 text-left">
                      <p className="text-xs font-black text-white group-hover:text-[#ff4b5c] transition-colors">
                         Classic Daily Wordle
                      </p>
                   </div>
                   <Clock size={14} className="text-gray-500 group-hover:text-white" />
                </button>
             )}
          </div>
      </motion.div>
   );
};
