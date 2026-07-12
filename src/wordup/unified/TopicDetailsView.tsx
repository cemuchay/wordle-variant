/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, UserPlus, Search, Trophy, ChevronLeft, Play, Users, Cpu } from "lucide-react";
import { CATEGORIES } from "../shared/constants";
import { CATEGORY_STYLE_MAP, DEFAULT_STYLE } from "../shared/categorySelectConstants";
import { type ProfileStats } from "../shared/types";
import { RankingView } from "../shared/RankingView";
import { ProtectedAvatar } from "../../components/chat/ProtectedAvatar";
import { supabase } from "../../lib/supabaseClient";

interface TopicDetailsViewProps {
   categoryId: string;
   onBack: () => void;
   currentUser: any;
   userStats: ProfileStats | null;
   getRankColor: (rankName: string) => string;
   allProfiles: any[];
   onPlayLive: () => void;
   onChallengePlayer: (targetUser: any) => void;
   onPlayBot: () => void;
}

export const TopicDetailsView = ({
   categoryId,
   onBack,
   currentUser,
   userStats,
   getRankColor,
   allProfiles,
   onPlayLive,
   onChallengePlayer,
   onPlayBot,
}: TopicDetailsViewProps) => {
   const [activeSection, setActiveSection] = useState<"play" | "rankings">("play");
   const [playerSearch, setPlayerSearch] = useState("");
   const [showInviteOverlay, setShowInviteOverlay] = useState(false);
   const [categoryStats, setCategoryStats] = useState<ProfileStats | null>(null);

   useEffect(() => {
      if (!currentUser || !categoryId) return;

      if (categoryId === "mixed") {
         Promise.resolve().then(() => {
            setCategoryStats(userStats);
         });
         return;
      }

      const fetchCategoryStats = async () => {
         try {
            const { data, error } = await supabase
               .from("wordup_category_profiles")
               .select("*")
               .eq("user_id", currentUser.id)
               .eq("category", categoryId)
               .maybeSingle();

            if (!error && data) {
               setCategoryStats(data as any);
            } else {
               setCategoryStats({
                  rating: 600,
                  xp: 0,
                  games_played: 0,
                  games_won: 0,
                  games_lost: 0,
                  games_tied: 0,
                  rank_name: "Bronze"
               } as any);
            }
         } catch (err) {
            console.error("Failed to fetch category stats:", err);
         }
      };

      fetchCategoryStats();
   }, [currentUser, categoryId, userStats]);

   const categoryObj = CATEGORIES.find((c) => c.id === categoryId) || CATEGORIES[0];
   const style = CATEGORY_STYLE_MAP[categoryId] || DEFAULT_STYLE;

   // Filter out current user and match username query
   const filteredPlayers = (allProfiles || []).filter((p: any) =>
      p.id !== currentUser?.id &&
      (p.username || "").toLowerCase().includes(playerSearch.toLowerCase())
   );

   return (
      <div className="flex flex-col flex-1 bg-[#121212] text-white min-h-0 relative select-none">
         {/* Cover Header */}
         {/* Cover Header */}
         <div className="relative pt-6 pb-8 px-6 bg-linear-to-b from-[#E85151]/20 via-[#181818]/60 to-[#121212] border-b border-white/10 flex flex-col items-center text-center">
            {/* Back Button */}
            <button
               onClick={onBack}
               className="absolute top-4 left-4 p-2 bg-black/40 hover:bg-black/60 rounded-full border border-white/10 transition-all cursor-pointer"
            >
               <ChevronLeft size={20} className="text-[#E85151]" />
            </button>

            {/* Category Emoji/SVG Circle */}
            <div className="w-20 h-20 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)] mb-4 overflow-hidden p-4">
               {style.svg ? (
                  <div className="w-full h-full text-white flex items-center justify-center [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: style.svg }} />
               ) : (
                  <span className="text-4xl">{style.emoji}</span>
               )}
            </div>

            {/* Category Title & Description */}
            <h1 className="text-2xl font-black uppercase tracking-wider text-white mb-2">
               {categoryObj.name}
            </h1>
            <p className="text-xs text-white font-bold max-w-sm">
               {categoryObj.desc}
            </p>
         </div>

         {/* Navigation Tab Bar */}
         <div className="flex border-b border-white/10 bg-[#181818] p-1">
            <button
               onClick={() => setActiveSection("play")}
               className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                  activeSection === "play"
                     ? "text-[#E85151] border-b-2 border-[#E85151]"
                     : "text-white/70 hover:text-white"
               }`}
            >
               <Play size={14} />
               <span>Play</span>
            </button>
            <button
               onClick={() => setActiveSection("rankings")}
               className={`flex-1 flex items-center justify-center gap-2 py-3 text-xs font-black uppercase tracking-widest transition-all ${
                  activeSection === "rankings"
                     ? "text-[#E85151] border-b-2 border-[#E85151]"
                     : "text-white/70 hover:text-white"
               }`}
            >
               <Trophy size={14} />
               <span>Rankings</span>
            </button>
         </div>

         {/* Content Area */}
         <div className="flex-1 overflow-y-auto p-5 scrollbar-hide">
            <AnimatePresence mode="wait">
               {activeSection === "play" ? (
                  <motion.div
                     key="play-section"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     className="space-y-6"
                  >
                     {/* User Stats Card */}
                     <div className="bg-white/5 border border-white/10 rounded-2xl p-4 grid grid-cols-3 text-center shadow-lg">
                        <div>
                           <p className="text-[9px] text-white/80 font-black uppercase tracking-wider">Rating</p>
                           {categoryStats ? (
                              <p className="text-base font-black text-white">{categoryStats.rating} ELO</p>
                           ) : (
                              <div className="h-5 w-16 bg-white/10 rounded-md animate-pulse mx-auto mt-1" />
                           )}
                        </div>
                        <div>
                           <p className="text-[9px] text-white/80 font-black uppercase tracking-wider">Rank</p>
                           {categoryStats ? (
                              <p className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border inline-block mt-1 ${getRankColor(categoryStats.rank_name)}`}>
                                 {categoryStats.rank_name}
                              </p>
                           ) : (
                              <div className="h-5 w-14 bg-white/10 rounded-md animate-pulse mx-auto mt-1" />
                           )}
                        </div>
                        <div>
                           <p className="text-[9px] text-white/80 font-black uppercase tracking-wider">Record</p>
                           {categoryStats ? (
                              <p className="text-base font-black text-[#E85151]">
                                 {categoryStats.games_won}<span className="text-white/80 text-xs">/</span><span className="text-red-400">{categoryStats.games_lost}</span>
                              </p>
                           ) : (
                              <div className="h-5 w-12 bg-white/10 rounded-md animate-pulse mx-auto mt-1" />
                           )}
                        </div>
                     </div>

                     {/* Action Buttons */}
                     <div className="space-y-3">
                        <button
                           onClick={onPlayLive}
                           className="w-full bg-[#E85151] hover:bg-[#d44343] text-white font-black uppercase py-4 rounded-2xl flex items-center justify-center gap-2.5 tracking-widest shadow-[0_4px_25px_rgba(232,81,81,0.25)] hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                        >
                           <Swords size={18} className="stroke-3" />
                           <span>Play Live Match</span>
                        </button>

                        <button
                           onClick={onPlayBot}
                           className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black uppercase py-4 rounded-2xl flex items-center justify-center gap-2.5 tracking-widest shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                        >
                           <Cpu size={18} className="stroke-3" />
                           <span>Practice vs Bot</span>
                        </button>

                        <button
                           onClick={() => setShowInviteOverlay(!showInviteOverlay)}
                           className="w-full bg-white hover:bg-gray-100 text-black font-black uppercase py-4 rounded-2xl flex items-center justify-center gap-2.5 tracking-widest shadow-md hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                        >
                           <UserPlus size={18} className="stroke-3" />
                           <span>Challenge a Friend</span>
                        </button>
                     </div>

                     {/* Collapsible Invite Friend Drawer */}
                     <AnimatePresence>
                        {showInviteOverlay && (
                           <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: "auto" }}
                              exit={{ opacity: 0, height: 0 }}
                              className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4 overflow-hidden"
                           >
                              <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                                 <Users size={16} className="text-[#E85151]" />
                                 <span className="text-xs font-black uppercase tracking-wider text-white">Select Opponent</span>
                              </div>

                              <div className="bg-black/40 border border-white/10 rounded-xl p-2.5 flex items-center gap-2">
                                 <Search size={16} className="text-white/60 shrink-0" />
                                 <input
                                    type="text"
                                    placeholder="Search username..."
                                    value={playerSearch}
                                    onChange={(e) => setPlayerSearch(e.target.value)}
                                    className="w-full bg-transparent text-xs text-white outline-none placeholder:text-white/40 font-bold"
                                 />
                              </div>

                              <div className="space-y-1.5 max-h-[180px] overflow-y-auto scrollbar-hide">
                                 {filteredPlayers.length > 0 ? (
                                    filteredPlayers.map((profile: any) => (
                                       <div
                                          key={profile.id}
                                          className="flex items-center justify-between bg-black/25 border border-white/10 rounded-xl p-2.5 hover:bg-white/5 transition-all"
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
                                             onClick={() => onChallengePlayer(profile)}
                                             className="flex items-center gap-1 bg-[#E85151]/10 hover:bg-[#E85151]/20 border border-[#E85151]/25 text-[#E85151] text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                                          >
                                             Challenge
                                          </button>
                                       </div>
                                    ))
                                 ) : (
                                    <div className="text-center py-4 text-white/60 text-[10px] font-bold uppercase tracking-wider">
                                       No players found
                                    </div>
                                 )}
                              </div>
                           </motion.div>
                        )}
                     </AnimatePresence>
                  </motion.div>
               ) : (
                  <motion.div
                     key="rankings-section"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     className="space-y-4"
                  >
                     <RankingView currentUser={currentUser} userStats={categoryStats} categoryId={categoryId} />
                  </motion.div>
               )}
            </AnimatePresence>
         </div>
      </div>
   );
};
