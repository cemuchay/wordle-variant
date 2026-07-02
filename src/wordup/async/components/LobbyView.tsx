/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, HelpCircle, ChevronDown, ChevronUp, Loader2, Volume2, VolumeX, RotateCcw, Search, UserPlus, Shuffle, GraduationCap } from "lucide-react";
import { CATEGORIES } from "../../shared/constants";
import { type ProfileStats } from "../../shared/types";
import { ProtectedAvatar } from "../../../components/chat/ProtectedAvatar";
import { CategorySelectModal, CATEGORY_STYLE_MAP } from "../../../components/wordup/WordUpView/components/CategorySelectModal";
import { useAsyncStore } from "../store/useAsyncStore";

interface AsyncLobbyViewProps {
   userStats: ProfileStats | null;
   category: string;
   setCategory: (cat: string) => void;
   getRankColor: (rankName: string) => string;
   allProfiles: any[];
   currentUser: any;
   onSelectHistoryMatch?: (match: any) => void;
   soundEnabled: boolean;
   onToggleSound: () => void;
   onPurgeAndReset: () => void;
   startChallenge: () => void;
   pendingMatches: any[];
   historyMatches: any[];
   isLoadingData: boolean;
   onPlayTurn: (match: any) => void;
   onChallengePlayer: (targetUser: any) => void;
   onRefreshPending: () => void;
   onRefreshHistory: () => void;
   onSwitchMode?: () => void;
   onBack?: () => void;
   onTutorial?: () => void;
}

export const LobbyView = ({
   userStats,
   category,
   setCategory,
   getRankColor,
   allProfiles,
   currentUser,
   onSelectHistoryMatch,
   soundEnabled,
   onToggleSound,
   onPurgeAndReset,
   startChallenge,
   pendingMatches,
   historyMatches,
   isLoadingData,
   onPlayTurn,
   onChallengePlayer,
   onRefreshPending,
   onRefreshHistory,
   onSwitchMode,
   onTutorial,
}: AsyncLobbyViewProps) => {
   const [showHelp, setShowHelp] = useState(false);
   const [showCategoryModal, setShowCategoryModal] = useState(false);
    const activeTab = useAsyncStore((s) => s.activeTab);
    const setActiveTab = useAsyncStore((s) => s.setActiveTab);
   const [playerSearch, setPlayerSearch] = useState("");
   const lastCategoryRef = useRef<string>(category || "mixed");

   useEffect(() => {
      if (activeTab === "pending") onRefreshPending();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [activeTab]);

   useEffect(() => {
      if (activeTab === "history") onRefreshHistory();
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [activeTab]);

   const pendingCount = (pendingMatches || []).filter((m: any) =>
      !(m.player1_id === currentUser?.id ? m.p1_answered : m.p2_answered)
   ).length;

   const filteredPlayers = (allProfiles || []).filter((p: any) =>
      p.id !== currentUser?.id &&
      (p.username || "").toLowerCase().includes(playerSearch.toLowerCase())
   );

   return (
      <motion.div
         initial={{ opacity: 0, y: 15 }}
         animate={{ opacity: 1, y: 0 }}
         exit={{ opacity: 0, y: -15 }}
         className="flex flex-col gap-4 md:gap-6 flex-1 justify-center py-1 md:py-2"
      >
         <div className="space-y-1 relative text-center">
            <div className="flex items-center justify-between gap-4 px-2 shrink-0">
               <h2 className="text-2xl font-black uppercase tracking-wider text-white">1 v 1 WordUp</h2>
               <div className="flex items-center gap-2">
                  {onSwitchMode && (

                     <button
                        onClick={onSwitchMode}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-correct/20 hover:bg-correct/30 border border-correct/30 text-correct text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                     >
                        <span>Live mode</span>
                        <Shuffle size={10} className="stroke-3" />
                     </button>
                  )}
                  <div className="flex items-center gap-2 w-[84px] justify-end">
                     <button
                        onClick={onToggleSound}
                        className="p-2 rounded-xl bg-indigo-950/30 hover:bg-indigo-950/40 border border-indigo-500/10 text-gray-400 hover:text-white transition-all cursor-pointer"
                        title="Toggle Sound"
                     >
                        {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                     </button>
                     <button
                        onClick={onPurgeAndReset}
                        className="p-2 rounded-xl bg-indigo-950/30 hover:bg-indigo-950/40 border border-indigo-500/10 text-gray-400 hover:text-red-400 transition-all cursor-pointer"
                        title="Reset Game State"
                     >
                        <RotateCcw size={15} />
                     </button>
                  </div>
               </div>
            </div>
         </div>

         <div className="flex bg-indigo-950/30 p-1 rounded-2xl border border-indigo-500/10 shrink-0 shadow-[0_0_15px_rgba(99,102,241,0.08)]">
            {(["play", "pending", "history"] as const).map((tab) => (
               <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 text-[10px] font-black uppercase py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === tab
                     ? "bg-indigo-500 text-white shadow-md shadow-indigo-500/30 font-black"
                     : "text-gray-400 hover:text-white"
                     }`}
               >
                  {tab === "play" ? "Play" : tab === "pending" ? `Pending${pendingCount > 0 ? ` (${pendingCount})` : ""}` : "History"}
               </button>
            ))}
         </div>

         <AnimatePresence mode="wait">
            {activeTab === "play" && (
               <motion.div
                  key="play-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-6"
               >
                  {userStats && (
                     <div className="grid grid-cols-3 bg-indigo-950/30 border border-indigo-500/10 rounded-2xl p-4 text-center">
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
                     {(() => {
                        const activeCatObj = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];
                        const style = CATEGORY_STYLE_MAP[activeCatObj.id] || { emoji: "💡", gradient: "from-slate-950/40 via-slate-900/30 to-slate-950/40", glow: "", border: "border-white/20 text-gray-300" };
                        const borderCol = style.border.split(" ")[0];
                        return (
                           <div className={`bg-linear-to-br ${style.gradient} border ${borderCol} ${style.glow} rounded-2xl p-4 flex flex-col gap-3 shadow-lg ring-1 ring-indigo-500/15`}>
                              <div className="flex items-center gap-3">
                                 <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/25 flex items-center justify-center text-lg shadow-inner shrink-0">
                                    {style.emoji}
                                 </div>
                                 <div className="min-w-0">
                                    <p className="text-[9px] text-gray-400 font-extrabold uppercase tracking-widest leading-none mb-1">Active Arena</p>
                                    <p className="text-base font-black uppercase tracking-wider text-white truncate leading-none">{activeCatObj.name}</p>
                                 </div>
                              </div>
                              <p className="text-xs text-gray-300 leading-relaxed font-bold">{activeCatObj.desc}</p>
                              <button
                                 onClick={() => setShowCategoryModal(true)}
                                 className="w-full mt-1 bg-white/10 hover:bg-white/20 border border-white/25 text-white font-black uppercase text-[10px] tracking-widest py-3 rounded-xl transition-all cursor-pointer text-center"
                              >
                                 Change Category / Select Modes
                              </button>
                           </div>
                        );
                     })()}

                     <CategorySelectModal
                        isOpen={showCategoryModal}
                        onClose={() => setShowCategoryModal(false)}
                        category={category}
                        setCategory={(id: string) => { lastCategoryRef.current = id; setCategory(id); }}
                        startMatchmaking={startChallenge}
                     />
                  </div>

                  <div className="space-y-3">
                     <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Challenge Players</p>
                     <div className="bg-indigo-950/30 border border-indigo-500/10 rounded-2xl p-3 flex items-center gap-2">
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
                     <div className="space-y-1 max-h-[240px] overflow-y-auto scrollbar-hide">
                        {filteredPlayers.length > 0 ? (
                           filteredPlayers.map((profile: any) => (
                              <div
                                 key={profile.id}
                                 className="flex items-center justify-between bg-indigo-950/30 border border-indigo-500/10 rounded-xl p-2.5 hover:bg-indigo-950/40 transition-all"
                              >
                                 <div className="flex items-center gap-2.5 min-w-0">
                                    <ProtectedAvatar
                                       userId={profile.id}
                                       src={profile.avatar_url}
                                       username={profile.username}
                                       className="w-8 h-8 rounded-full shrink-0"
                                    />
                                    <div className="min-w-0">
                                       <p className="text-xs font-black text-white truncate">{profile.username}</p>
                                    </div>
                                 </div>
                                 <button
                                    onClick={() => onChallengePlayer(profile)}
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
                     onClick={startChallenge}
                     className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-black uppercase py-4 rounded-2xl flex items-center justify-center gap-2 tracking-widest shadow-[0_4px_20px_rgba(99,102,241,0.3)] cursor-pointer hover:scale-102 active:scale-98 transition-all"
                  >
                     <Swords size={16} /> Start New Challenge
                  </button>
               </motion.div>
            )}

            {activeTab === "pending" && (
               <motion.div
                  key="pending-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3 min-h-[200px]"
               >
                  {isLoadingData ? (
                     <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                     </div>
                  ) : pendingMatches.length > 0 ? (
                     <div className="space-y-2">
                        {pendingMatches.map((match: any) => {
                           const isP1 = match.player1_id === currentUser?.id;
                           const oppProfile = isP1 ? match.player2 : match.player1;
                           const oppName = oppProfile?.username || "Opponent";
                           const hasPlayed = isP1 ? match.p1_answered : match.p2_answered;
                           const myTurn = !hasPlayed;
                           const statusText = myTurn ? "Your Turn" : "Waiting for Opponent";

                           return (
                              <div
                                 key={match.id}
                                 className="bg-indigo-950/30 border border-indigo-500/10 rounded-2xl p-3.5 flex items-center justify-between text-xs"
                              >
                                 <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                       <p className="font-black text-white truncate">vs {oppName}</p>
                                       <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md tracking-wider ${myTurn ? "bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 animate-pulse" : "bg-yellow-500/10 border border-yellow-500/30 text-yellow-400"}`}>
                                          {statusText}
                                       </span>
                                    </div>
                                    <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">{match.category?.replace(/_/g, " ")}</p>
                                 </div>
                                 {myTurn ? (
                                    <button
                                       onClick={() => onPlayTurn(match)}
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
                  ) : (
                     <div className="text-center py-12 text-gray-500">
                        <p className="text-[10px] uppercase font-black tracking-wider">No pending matches</p>
                        <p className="text-[9px] text-gray-600 mt-1 font-bold">Challenge someone from the Play tab</p>
                     </div>
                  )}
               </motion.div>
            )}

            {activeTab === "history" && (
               <motion.div
                  key="history-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3 min-h-[200px]"
               >
                  {isLoadingData ? (
                     <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-6 h-6 text-indigo-400 animate-spin" />
                     </div>
                  ) : historyMatches.length > 0 ? (
                     <div className="space-y-2">
                        {historyMatches.map((match: any) => {
                           const isP1 = match.player1_id === currentUser?.id;
                           const oppProfile = isP1 ? match.player2 : match.player1;
                           const myScore = isP1 ? match.p1_score || 0 : match.p2_score || 0;
                           const oppScore = isP1 ? match.p2_score || 0 : match.p1_score || 0;
                           const oppName = oppProfile?.username || "Opponent";

                           let outcome = "DRAW";
                           let outcomeColor = "text-gray-400 bg-gray-500/10 border-gray-500/20";
                           if (myScore > oppScore) {
                              outcome = "WIN";
                              outcomeColor = "text-indigo-400 bg-indigo-500/10 border-indigo-500/20";
                           } else if (oppScore > myScore) {
                              outcome = "LOSS";
                              outcomeColor = "text-red-400 bg-red-500/10 border-red-500/20";
                           }

                           const dateStr = new Date(match.completed_at || match.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric'
                           });

                           return (
                              <div
                                 key={match.id}
                                 onClick={() => onSelectHistoryMatch?.(match)}
                                 className="bg-indigo-950/30 border border-indigo-500/10 rounded-2xl p-3.5 flex items-center justify-between text-xs cursor-pointer hover:bg-indigo-950/40 active:scale-98 transition-all"
                              >
                                 <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                       <p className="font-black text-white truncate">vs {oppName}</p>
                                    </div>
                                    <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">{match.category?.replace(/_/g, " ")} • {dateStr}</p>
                                 </div>
                                 <div className="flex items-center gap-3 shrink-0">
                                    <span className="font-bold text-white text-[11px]">{myScore} - {oppScore}</span>
                                    <span className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg border ${outcomeColor}`}>
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

         <div className="bg-indigo-950/30 border border-indigo-500/10 rounded-2xl overflow-hidden transition-all duration-300">
            <button
               onClick={() => setShowHelp(!showHelp)}
               className="w-full flex items-center justify-between p-4 text-xs font-black uppercase tracking-wider text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
               <div className="flex items-center gap-2">
                  <HelpCircle size={14} className="text-indigo-400" />
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
                        <p>Play at your own pace! Start a challenge, answer questions, and submit when ready. Your opponent plays their turn later — the match updates when both have played.</p>
                     </div>
                     <div>
                        <p className="font-black text-white uppercase tracking-wider mb-1">Scoring System</p>
                        <ul className="list-disc pl-4 space-y-1">
                           <li><strong className="text-indigo-400">Correct answer</strong>: <strong className="text-white">11–20 points</strong> (decays over time with a 1.5s grace period).</li>
                           <li><strong className="text-indigo-400">Speed Bonus</strong>: Faster answers earn more — the 20-point max drops to 11 at the time limit.</li>
                           <li><strong className="text-pink-500">Round 7 (Final Round)</strong>: All points are <strong className="text-pink-500">DOUBLED</strong>! Make it count!</li>
                        </ul>
                     </div>
                     <div>
                        <p className="font-black text-white uppercase tracking-wider mb-1">Question Types</p>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                           <div className="bg-indigo-950/20 p-2 rounded-lg">
                              <strong className="text-white block text-[10px]">Anagrams</strong> Scramble letters back into a word.
                           </div>
                           <div className="bg-indigo-950/20 p-2 rounded-lg">
                              <strong className="text-white block text-[10px]">Definitions</strong> Match the word to its dictionary definition.
                           </div>
                           <div className="bg-indigo-950/20 p-2 rounded-lg">
                              <strong className="text-white block text-[10px]">Reverse Wordle</strong> Guess the word that generated the pattern.
                           </div>
                           <div className="bg-indigo-950/20 p-2 rounded-lg">
                              <strong className="text-white block text-[10px]">Real / Fake</strong> Spot authentic words vs fake mutations.
                           </div>
                           <div className="bg-indigo-950/20 p-2 rounded-lg">
                              <strong className="text-white block text-[10px]">Missing Letter</strong> Complete the blank to spell a valid word.
                           </div>
                            <div className="bg-indigo-950/20 p-2 rounded-lg">
                               <strong className="text-white block text-[10px]">Pattern Rules</strong> Answer True/False for letter conditions.
                            </div>
                         </div>
                      </div>
                      {onTutorial && (
                         <button
                            onClick={onTutorial}
                            className="w-full flex items-center justify-center gap-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 font-black py-2.5 rounded-xl text-[10px] uppercase tracking-wider transition-all border border-indigo-500/20 cursor-pointer"
                         >
                            <GraduationCap size={13} />
                            Play Tutorial
                         </button>
                      )}
                   </motion.div>
               )}
            </AnimatePresence>
         </div>
      </motion.div>
   );
};
