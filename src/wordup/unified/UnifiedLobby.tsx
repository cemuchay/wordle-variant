/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
   Radio, Shield, Play, HelpCircle, ChevronDown, ChevronUp,
   Clock, Flame, Swords, Search, UserPlus, Loader2, Trophy,
    Volume2, VolumeX
} from "lucide-react";
import { CATEGORIES } from "../shared/constants";
import { CATEGORY_STYLE_MAP, DEFAULT_STYLE, loadRecents } from "../shared/categorySelectConstants";
import { type ProfileStats } from "../shared/types";
import { supabase } from "../../lib/supabaseClient";
import { TopicDetailsView } from "./TopicDetailsView";
import { RankingView } from "../shared/RankingView";
import { CategorySelectModal } from "../shared/CategorySelectModal";
import { ProtectedAvatar } from "../../components/chat/ProtectedAvatar";
import formatUsername from "../../utils/formatUsername";

type TabId = "home" | "live" | "async" | "rankings" | "history";

interface UnifiedLobbyProps {
   userStats: ProfileStats | null;
   getRankColor: (rankName: string) => string;
   allProfiles: any[];
   currentUser: any;
   onSelectHistoryMatch?: (match: any) => void;
   soundEnabled: boolean;
   onToggleSound: () => void;
   onPlayLive: (catId: string) => void;
   onPlayAsync: (targetUser: any, catId: string) => void;
   onPlayAsyncTurn: (match: any) => void;
   pendingMatches: any[];
   onRefreshPending: () => void;
   onBackToClassic?: () => void;
    onTutorial?: () => void;
}

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
   { id: "home", label: "Home", icon: <Play size={13} /> },
   { id: "live", label: "Live", icon: <Radio size={13} /> },
   { id: "async", label: "1v1", icon: <Shield size={13} /> },
   { id: "rankings", label: "Rankings", icon: <Trophy size={13} /> },
   { id: "history", label: "History", icon: <Clock size={13} /> },
];

export const UnifiedLobby = ({
   userStats,
   getRankColor,
   allProfiles,
   currentUser,
   onSelectHistoryMatch,
   soundEnabled,
   onToggleSound,
   onPlayLive,
   onPlayAsync,
   onPlayAsyncTurn,
   pendingMatches,
   onBackToClassic,
   onTutorial,
}: UnifiedLobbyProps) => {
   const [activeTab, setActiveTab] = useState<TabId>("home");
   const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
   const [liveCategory, setLiveCategory] = useState("mixed");
   const [asyncCategory, setAsyncCategory] = useState("mixed");
   const [historyMatches, setHistoryMatches] = useState<any[]>([]);
   const [asyncHistoryMatches, setAsyncHistoryMatches] = useState<any[]>([]);
   const [isLoadingHistory, setIsLoadingHistory] = useState(false);
   const [showHelp, setShowHelp] = useState(false);
   const [showCategoryModalFor, setShowCategoryModalFor] = useState<"live" | "async" | null>(null);
   const [recentCategoryIds, setRecentCategoryIds] = useState<string[]>([]);
   const [playerSearch, setPlayerSearch] = useState("");

   useEffect(() => {
      setRecentCategoryIds(loadRecents());
   }, [selectedCategoryId]);

   const fetchHistory = useCallback(async () => {
      if (!currentUser) return;
      setIsLoadingHistory(true);
      try {
         const { data: liveData } = await supabase
            .from("wordup_matches")
            .select(`
               *,
               player1:player1_id (username, avatar_url),
               player2:player2_id (username, avatar_url)
            `)
            .eq("status", "completed")
            .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id}`)
            .order("completed_at", { ascending: false })
            .limit(30);

         if (liveData) setHistoryMatches(liveData);

         const { data: asyncData } = await supabase
            .from("wordup_async_matches")
            .select(`
               *,
               player1:player1_id (username, avatar_url),
               player2:player2_id (username, avatar_url)
            `)
            .eq("status", "completed")
            .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id}`)
            .order("completed_at", { ascending: false })
            .limit(30);

         if (asyncData) setAsyncHistoryMatches(asyncData);
      } catch (e) {
         console.error("Failed to fetch history:", e);
      } finally {
         setIsLoadingHistory(false);
      }
   }, [currentUser]);

   useEffect(() => {
      if (activeTab === "history") fetchHistory();
   }, [activeTab, fetchHistory]);

   const allHistory = [...(historyMatches || []), ...(asyncHistoryMatches || [])]
      .sort((a, b) => new Date(b.completed_at || b.created_at).getTime() - new Date(a.completed_at || a.created_at).getTime());

   if (selectedCategoryId) {
      return (
         <TopicDetailsView
            categoryId={selectedCategoryId}
            onBack={() => setSelectedCategoryId(null)}
            currentUser={currentUser}
            userStats={userStats}
            getRankColor={getRankColor}
            allProfiles={allProfiles}
            onPlayLive={() => onPlayLive(selectedCategoryId)}
            onChallengePlayer={(targetUser) => onPlayAsync(targetUser, selectedCategoryId)}
         />
      );
   }

   const catObj = CATEGORIES.find(c => c.id === liveCategory) || CATEGORIES[0];
   const catStyle = CATEGORY_STYLE_MAP[catObj.id] || DEFAULT_STYLE;

   const asyncCatObj = CATEGORIES.find(c => c.id === asyncCategory) || CATEGORIES[0];
   const asyncCatStyle = CATEGORY_STYLE_MAP[asyncCatObj.id] || DEFAULT_STYLE;

   const frequentCategories = CATEGORIES.filter((c) => recentCategoryIds.includes(c.id));
   const allCategories = CATEGORIES;

   const filteredPlayers = (allProfiles || []).filter((p: any) =>
      p.id !== currentUser?.id &&
      (p.username || "").toLowerCase().includes(playerSearch.toLowerCase())
   );

   const pendingCount = (pendingMatches || []).filter((m: any) =>
      !(m.player1_id === currentUser?.id ? m.p1_answered : m.p2_answered)
   ).length;

   const buildActivityFeed = () => {
      const feedItems: any[] = [];

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

      historyMatches.slice(0, 5).forEach((match) => {
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

      if (userStats) {
         feedItems.push({
            id: `rank-milestone-${userStats.rank_name}`,
            type: "rank_milestone",
            timestamp: new Date().getTime() - 1000,
            rankName: userStats.rank_name,
            rating: userStats.rating,
         });
      }

      return feedItems.sort((a, b) => b.timestamp - a.timestamp).slice(0, 5);
   };

   return (
      <motion.div
         initial={{ opacity: 0, y: 15 }}
         animate={{ opacity: 1, y: 0 }}
         exit={{ opacity: 0, y: -15 }}
         className="flex flex-col gap-3 flex-1 bg-[#121212] text-white py-1 md:py-2 select-none min-h-0 overflow-y-auto scrollbar-hide"
      >
         {/* Header */}
         <div className="flex items-center justify-between px-4 pb-2 border-b border-white/5 shrink-0">
            <div className="flex items-center gap-2">
               <div className="w-7 h-7 rounded-xl bg-[#ff4b5c] flex items-center justify-center text-white shadow-md shadow-[#ff4b5c]/35">
                  <Play size={14} fill="white" />
               </div>
               <h1 className="text-lg font-black uppercase tracking-wider text-white">WordUp Arena</h1>
            </div>
            <div className="flex items-center gap-1.5">
               <button
                  onClick={onToggleSound}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
                  title="Toggle Sound"
               >
                  {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
               </button>
               {onTutorial && (
                  <button
                     onClick={onTutorial}
                     className="bg-white/5 hover:bg-white/10 border border-white/15 px-2.5 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-widest text-[#ff4b5c] cursor-pointer"
                  >
                     Tutorial
                  </button>
               )}
            </div>
         </div>

         {/* Tab Bar */}
         <div className="flex gap-0.5 px-4 shrink-0">
            {TABS.map((tab) => (
               <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center justify-center gap-1.5 flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all cursor-pointer ${
                     activeTab === tab.id
                        ? "bg-[#ff4b5c] text-white shadow-md shadow-[#ff4b5c]/30"
                        : "text-gray-500 hover:text-white hover:bg-white/5"
                  }`}
               >
                  {tab.icon}
                  <span>{tab.label}</span>
               </button>
            ))}
         </div>

         {/* Content Area */}
         <div className="flex-1 overflow-y-auto scrollbar-hide px-4 pb-4">
            <AnimatePresence mode="wait">
               {/* HOME TAB */}
               {activeTab === "home" && (
                  <motion.div
                     key="home"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     className="flex flex-col gap-4"
                  >
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

                     {/* Activity Feed */}
                     <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-gray-500">
                           <Radio size={14} className="text-[#ff4b5c] animate-pulse" />
                           <span className="text-[10px] font-black uppercase tracking-wider">Latest Activity</span>
                        </div>
                        <div className="space-y-2 bg-[#181818] border border-white/5 p-3 rounded-2xl shadow-inner min-h-[80px]">
                           {buildActivityFeed().length > 0 ? (
                              buildActivityFeed().map((item) => {
                                 const itemCatObj = CATEGORIES.find(c => c.id === item.category);
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
                                                   {itemCatObj?.name || "Trivia"}
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
                                                   {itemCatObj?.name || "Trivia"}
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

                     {/* All Topics */}
                     <div className="space-y-2">
                        <p className="text-[10px] font-black uppercase tracking-wider text-gray-500">Topics</p>
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

                     {/* Help Section */}
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
                     <div className="mt-2 pt-4 border-t border-white/5 mb-2 space-y-2">
                        {onBackToClassic && (
                           <button
                              onClick={onBackToClassic}
                              className="w-full flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 transition-all cursor-pointer group"
                           >
                              <div className="flex-1 text-left">
                                 <p className="text-xs font-black text-white group-hover:text-[#ff4b5c] transition-colors">Classic Daily Wordle</p>
                              </div>
                              <Clock size={14} className="text-gray-500 group-hover:text-white" />
                           </button>
                        )}
                     </div>
                  </motion.div>
               )}

               {/* LIVE TAB */}
               {activeTab === "live" && (
                  <motion.div
                     key="live"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     className="space-y-5"
                  >
                     {userStats && (
                        <div className="grid grid-cols-3 bg-[#181818] border border-white/5 rounded-2xl p-4 text-center shadow-md">
                           <div>
                              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Rating</p>
                              <p className="text-lg font-black text-white">{userStats.rating} ELO</p>
                           </div>
                           <div>
                              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Rank</p>
                              <p className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border inline-block mt-1 ${getRankColor(userStats.rank_name)}`}>
                                 {userStats.rank_name}
                              </p>
                           </div>
                           <div>
                              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Wins/Losses</p>
                              <p className="text-lg font-black text-correct">
                                 {userStats.games_won}<span className="text-gray-500 text-xs">/</span><span className="text-red-400">{userStats.games_lost}</span>
                              </p>
                           </div>
                        </div>
                     )}

                     <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Active Arena Category</p>
                        <div className={`bg-linear-to-br ${catStyle.gradient} border ${catStyle.border.split(" ")[0]} ${catStyle.glow} rounded-2xl p-4 flex flex-col gap-3 shadow-lg`}>
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/25 flex items-center justify-center text-lg shadow-inner shrink-0">
                                 {catStyle.emoji}
                              </div>
                              <div className="min-w-0">
                                 <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-widest leading-none mb-1">Active Arena</p>
                                 <p className="text-base font-black uppercase tracking-wider text-white truncate leading-none">{catObj.name}</p>
                              </div>
                           </div>
                           <p className="text-xs text-gray-300 leading-relaxed font-bold">{catObj.desc}</p>
                           <button
                              onClick={() => setShowCategoryModalFor("live")}
                              className="w-full mt-1 bg-white/10 hover:bg-white/20 border border-white/25 text-white font-black uppercase text-[10px] tracking-widest py-3 rounded-xl transition-all cursor-pointer text-center"
                           >
                              Change Category
                           </button>
                        </div>
                     </div>

                     <button
                        onClick={() => onPlayLive(liveCategory)}
                        className="w-full bg-correct hover:bg-correct/90 text-black font-black uppercase py-4 rounded-2xl flex items-center justify-center gap-2 tracking-widest shadow-[0_4px_20px_rgba(46,204,113,0.3)] cursor-pointer hover:scale-102 active:scale-98 transition-all"
                     >
                        <Swords size={16} /> Search Opponent
                     </button>

                     <CategorySelectModal
                        isOpen={showCategoryModalFor === "live"}
                        onClose={() => setShowCategoryModalFor(null)}
                        category={liveCategory}
                        setCategory={(id) => { setLiveCategory(id); setShowCategoryModalFor(null); }}
                        startMatchmaking={() => { setShowCategoryModalFor(null); onPlayLive(liveCategory); }}
                     />
                  </motion.div>
               )}

               {/* 1V1 (ASYNC) TAB */}
               {activeTab === "async" && (
                  <motion.div
                     key="async"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     className="space-y-5"
                  >
                     {userStats && (
                        <div className="grid grid-cols-3 bg-[#181818] border border-white/5 rounded-2xl p-4 text-center shadow-md">
                           <div>
                              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Rating</p>
                              <p className="text-lg font-black text-white">{userStats.rating} ELO</p>
                           </div>
                           <div>
                              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Rank</p>
                              <p className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg border inline-block mt-1 ${getRankColor(userStats.rank_name)}`}>
                                 {userStats.rank_name}
                              </p>
                           </div>
                           <div>
                              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-wider">Wins/Losses</p>
                              <p className="text-lg font-black text-indigo-400">
                                 {userStats.games_won}<span className="text-gray-500 text-xs">/</span><span className="text-red-400">{userStats.games_lost}</span>
                              </p>
                           </div>
                        </div>
                     )}

                     <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Active Arena Category</p>
                        <div className={`bg-linear-to-br ${asyncCatStyle.gradient} border ${asyncCatStyle.border.split(" ")[0]} ${asyncCatStyle.glow} rounded-2xl p-4 flex flex-col gap-3 shadow-lg ring-1 ring-indigo-500/15`}>
                           <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/25 flex items-center justify-center text-lg shadow-inner shrink-0">
                                 {asyncCatStyle.emoji}
                              </div>
                              <div className="min-w-0">
                                 <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-widest leading-none mb-1">Active Arena</p>
                                 <p className="text-base font-black uppercase tracking-wider text-white truncate leading-none">{asyncCatObj.name}</p>
                              </div>
                           </div>
                           <p className="text-xs text-gray-300 leading-relaxed font-bold">{asyncCatObj.desc}</p>
                           <button
                              onClick={() => setShowCategoryModalFor("async")}
                              className="w-full mt-1 bg-white/10 hover:bg-white/20 border border-white/25 text-white font-black uppercase text-[10px] tracking-widest py-3 rounded-xl transition-all cursor-pointer text-center"
                           >
                              Change Category
                           </button>
                        </div>
                     </div>

                     <div className="space-y-3">
                        <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Challenge Players</p>
                        <div className="bg-[#181818] border border-white/5 rounded-2xl p-3 flex items-center gap-2">
                           <Search size={16} className="text-gray-500 shrink-0" />
                           <input
                              type="text"
                              placeholder="Search by username..."
                              value={playerSearch}
                              onChange={(e) => setPlayerSearch(e.target.value)}
                              className="w-full bg-transparent text-xs text-white outline-none placeholder:text-gray-500 font-bold"
                           />
                           {playerSearch && (
                              <button onClick={() => setPlayerSearch("")} className="text-[10px] font-black uppercase text-gray-500 hover:text-white tracking-widest cursor-pointer">
                                 Clear
                              </button>
                           )}
                        </div>
                        <div className="space-y-1 max-h-[200px] overflow-y-auto scrollbar-hide">
                           {filteredPlayers.length > 0 ? (
                              filteredPlayers.map((profile: any) => (
                                 <div
                                    key={profile.id}
                                    className="flex items-center justify-between bg-[#181818] border border-white/5 rounded-xl p-2.5 hover:bg-white/5 transition-all"
                                 >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                       <ProtectedAvatar
                                          userId={profile.id}
                                          src={profile.avatar_url}
                                          username={profile.username}
                                          className="w-7 h-7 rounded-full shrink-0"
                                       />
                                       <div className="min-w-0">
                                          <p className="text-xs font-black text-white truncate">{profile.username}</p>
                                       </div>
                                    </div>
                                    <button
                                       onClick={() => onPlayAsync(profile, asyncCategory)}
                                       className="flex items-center gap-1 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-400 text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                                    >
                                       <UserPlus size={12} />
                                       Invite
                                    </button>
                                 </div>
                              ))
                           ) : (
                              <div className="text-center py-6 text-gray-500 text-[10px] font-bold uppercase tracking-wider">
                                 {playerSearch ? "No players found" : "No other players available"}
                              </div>
                           )}
                        </div>
                     </div>

                     <button
                        onClick={() => {
                           if (filteredPlayers.length > 0) {
                              onPlayAsync(filteredPlayers[0], asyncCategory);
                           }
                        }}
                        className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-black uppercase py-4 rounded-2xl flex items-center justify-center gap-2 tracking-widest shadow-[0_4px_20px_rgba(99,102,241,0.3)] cursor-pointer hover:scale-102 active:scale-98 transition-all"
                        disabled={filteredPlayers.length === 0}
                     >
                        <Swords size={16} /> Start New Challenge
                     </button>

                     {/* Pending Challenges Subsection */}
                     {pendingMatches.length > 0 && (
                        <div className="space-y-3">
                           <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider pt-2 border-t border-white/5">
                              Pending Challenges {pendingCount > 0 && <span className="text-indigo-400">({pendingCount} your turn)</span>}
                           </p>
                           {pendingMatches.map((match: any) => {
                              const isP1 = match.player1_id === currentUser?.id;
                              const oppProfile = isP1 ? match.player2 : match.player1;
                              const oppName = oppProfile?.username || "Opponent";
                              const hasPlayed = isP1 ? match.p1_answered : match.p2_answered;
                              const myTurn = !hasPlayed;

                              return (
                                 <div
                                    key={match.id}
                                    className="bg-[#181818] border border-white/5 rounded-2xl p-3.5 flex items-center justify-between text-xs"
                                 >
                                    <div className="min-w-0">
                                       <div className="flex items-center gap-2">
                                          <p className="font-black text-white truncate">vs {oppName}</p>
                                          <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-wider ${myTurn ? "bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 animate-pulse" : "bg-yellow-500/10 border border-yellow-500/30 text-yellow-400"}`}>
                                             {myTurn ? "Your Turn" : "Waiting"}
                                          </span>
                                       </div>
                                       <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">{match.category?.replace(/_/g, " ")}</p>
                                    </div>
                                    {myTurn ? (
                                       <button
                                          onClick={() => onPlayAsyncTurn(match)}
                                          className="bg-indigo-500 hover:bg-indigo-600 text-white font-black uppercase text-[9px] tracking-wider px-4 py-2 rounded-xl transition-all cursor-pointer"
                                       >
                                          Play Turn
                                       </button>
                                    ) : (
                                       <button
                                          onClick={() => onSelectHistoryMatch?.(match)}
                                          className="bg-white/10 hover:bg-white/20 border border-white/25 text-white font-black uppercase text-[9px] tracking-wider px-4 py-2 rounded-xl transition-all cursor-pointer"
                                       >
                                          Preview
                                       </button>
                                    )}
                                 </div>
                              );
                           })}
                        </div>
                     )}

                     <CategorySelectModal
                        isOpen={showCategoryModalFor === "async"}
                        onClose={() => setShowCategoryModalFor(null)}
                        category={asyncCategory}
                        setCategory={(id) => { setAsyncCategory(id); setShowCategoryModalFor(null); }}
                        startMatchmaking={() => { setShowCategoryModalFor(null); }}
                     />
                  </motion.div>
               )}

               {/* RANKINGS TAB */}
               {activeTab === "rankings" && (
                  <motion.div
                     key="rankings"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                  >
                     <RankingView currentUser={currentUser} userStats={userStats} />
                  </motion.div>
               )}

               {/* HISTORY TAB */}
               {activeTab === "history" && (
                  <motion.div
                     key="history"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     className="space-y-3 min-h-[200px]"
                  >
                     <div className="flex items-center gap-2">
                        <Clock size={14} className="text-[#ff4b5c]" />
                        <h3 className="text-xs font-black uppercase tracking-widest text-white">Match History</h3>
                     </div>
                     {isLoadingHistory ? (
                        <div className="flex items-center justify-center py-12">
                           <Loader2 className="w-6 h-6 text-[#ff4b5c] animate-spin" />
                        </div>
                     ) : allHistory.length > 0 ? (
                        <div className="space-y-2">
                           {allHistory.map((match) => {
                              const isP1 = match.player1_id === currentUser?.id;
                              const oppProfile = isP1 ? match.player2 : match.player1;
                              const myScore = isP1 ? match.p1_score || 0 : match.p2_score || 0;
                              const oppScore = isP1 ? match.p2_score || 0 : match.p1_score || 0;
                              const oppName = match.is_bot_match ? "Word Bot" : (oppProfile?.username || "Opponent");

                              let outcome = "DRAW";
                              let outcomeStyle = "text-gray-400 border-white/10 bg-white/5";
                              if (myScore > oppScore) {
                                 outcome = "WIN";
                                 outcomeStyle = "text-[#ff4b5c] border-[#ff4b5c]/20 bg-[#ff4b5c]/10";
                              } else if (oppScore > myScore) {
                                 outcome = "LOSS";
                                 outcomeStyle = "text-red-400 border-red-500/10 bg-red-500/10";
                              }

                              const dateStr = new Date(match.completed_at || match.created_at).toLocaleDateString(undefined, {
                                 month: 'short',
                                 day: 'numeric'
                              });

                              const isLive = !!match.p1_score && match.game_type !== "async" && !match.encrypted_questions;
                              const mode = isLive ? "Live" : "1v1";
                              const modeColor = isLive ? "text-correct" : "text-indigo-400";

                              return (
                                 <div
                                    key={match.id}
                                    onClick={() => onSelectHistoryMatch?.(match)}
                                    className="flex items-center justify-between bg-[#181818] border border-white/5 rounded-2xl p-3.5 text-xs cursor-pointer hover:bg-white/5 active:scale-98 transition-all"
                                 >
                                    <div className="min-w-0">
                                       <div className="flex items-center gap-2">
                                          <p className="font-black text-white truncate">vs {oppName}</p>
                                          <span className={`text-[7.5px] font-black uppercase ${modeColor}`}>{mode}</span>
                                       </div>
                                       <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">
                                          {match.category?.replace(/_/g, " ")} • {dateStr}
                                       </p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                       <span className="font-bold text-white text-[11px]">{myScore} - {oppScore}</span>
                                       <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border ${outcomeStyle}`}>
                                          {outcome}
                                       </span>
                                    </div>
                                 </div>
                              );
                           })}
                        </div>
                     ) : (
                        <div className="text-center py-12 text-gray-500">
                           <p className="text-[10px] uppercase font-black tracking-wider">No completed matches</p>
                        </div>
                     )}
                  </motion.div>
               )}
            </AnimatePresence>
         </div>
      </motion.div>
   );
};

export default UnifiedLobby;
