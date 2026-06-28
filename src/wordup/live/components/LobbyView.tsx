/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HelpCircle, ChevronDown, ChevronUp, Loader2, Volume2, VolumeX, RotateCcw, Swords, Shuffle, Radio } from "lucide-react";
import { CATEGORIES } from "../../shared/constants";
import { type ProfileStats } from "../../shared/types";
import { supabase } from "../../../lib/supabaseClient";
import { useLiveStore } from "../store/useLiveStore";
import { safeLocalStorage } from "../../../utils/storage";
import { CategorySelectModal, CATEGORY_STYLE_MAP } from "../../../components/wordup/WordUpView/components/CategorySelectModal";
import { RankingView } from "../../../components/wordup/WordUpView/components/RankingView";

interface LobbyViewProps {
   userStats: ProfileStats | null;
   category: string;
   setCategory: (cat: string) => void;
   startMatchmaking: () => void;
   getRankColor: (rankName: string) => string;
   currentUser: any;
   onSelectHistoryMatch?: (match: any) => void;
   soundEnabled: boolean;
   onToggleSound: () => void;
   onPurgeAndReset: () => void;
   onSwitchMode?: () => void;
   onBack?: () => void;
}

export const LobbyView = ({
   userStats,
   category,
   setCategory,
   startMatchmaking,
   getRankColor,
   currentUser,
   onSelectHistoryMatch,
   soundEnabled,
   onToggleSound,
   onPurgeAndReset,
   onSwitchMode,
}: LobbyViewProps) => {
   const [showHelp, setShowHelp] = useState(false);
   const [showCategoryModal, setShowCategoryModal] = useState(false);
   const lastCategoryRef = useRef<string>(category || "mixed");

    const activeTab = useLiveStore((s) => s.activeTab);
    const setActiveTab = useLiveStore((s) => s.setActiveTab);
    const [historyMatches, setHistoryMatches] = useState<any[]>([]);
   const [isLoadingData, setIsLoadingData] = useState(false);

   const fetchHistory = useCallback(async () => {
      if (!currentUser) return;
      await Promise.resolve();
      setIsLoadingData(true);
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
            .limit(15);

         if (error) throw error;
         setHistoryMatches(data || []);
      } catch (e) {
         console.error("Failed to fetch history:", e);
      } finally {
         setIsLoadingData(false);
      }
   }, [currentUser]);

   useEffect(() => {
      let active = true;
      const timer = setTimeout(() => {
         if (active && activeTab === "history") {
            fetchHistory();
         }
      }, 0);
      return () => {
         active = false;
         clearTimeout(timer);
      };
   }, [activeTab, currentUser?.id, fetchHistory]);

   return (
      <motion.div
         initial={{ opacity: 0, y: 15 }}
         animate={{ opacity: 1, y: 0 }}
         exit={{ opacity: 0, y: -15 }}
         className="flex flex-col gap-4 md:gap-6 flex-1 justify-center py-1 md:py-2"
      >
         <div className="space-y-1 relative text-center">

            <div className="flex items-center justify-between gap-4 px-2 shrink-0">
               <div className="inline-flex items-center gap-2 px-3 py-1.5 mb-2 text-xs font-black uppercase tracking-widest">
                  <Radio size={18} className="animate-pulse stroke-3" />
                  <span className="text-xl">Live Mode</span>
               </div>
               <div className="flex items-center gap-2">
                  {onSwitchMode && (
                     <button
                        onClick={onSwitchMode}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-400 text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer"
                     >
                        <span>1 v 1 mode</span>
                        <Shuffle size={10} className="stroke-3" />
                     </button>
                  )}
                  <div className="flex items-center gap-2 w-[84px] justify-end">
                     <button
                        onClick={onToggleSound}
                        className="p-2 rounded-xl bg-correct/5 hover:bg-correct/10 border border-correct/10 text-gray-400 hover:text-white transition-all cursor-pointer"
                        title="Toggle Sound"
                     >
                        {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                     </button>
                     <button
                        onClick={onPurgeAndReset}
                        className="p-2 rounded-xl bg-correct/5 hover:bg-correct/10 border border-correct/10 text-gray-400 hover:text-red-400 transition-all cursor-pointer"
                        title="Reset Game State"
                     >
                        <RotateCcw size={15} />
                     </button>
                  </div>
               </div>
            </div>
         </div>

         <div className="flex bg-correct/5 p-1 rounded-2xl border border-correct/10 shrink-0 shadow-[0_0_15px_rgba(106,170,100,0.08)]">
            {(["play", "rankings", "history"] as const).map((tab) => (
               <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 text-[10px] font-black uppercase py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === tab
                     ? "bg-correct text-black shadow-md shadow-correct/30 font-black"
                     : "text-gray-400 hover:text-white"
                     }`}
               >
                  {tab === "play" ? "Play" : tab === "rankings" ? "Rankings" : "History"}
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
                     <div className="grid grid-cols-3 bg-correct/5 border border-correct/10 rounded-2xl p-4 text-center">
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
                     {(() => {
                        const activeCatObj = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];
                        const style = CATEGORY_STYLE_MAP[activeCatObj.id] || { emoji: "💡", gradient: "from-slate-950/40 via-slate-900/30 to-slate-950/40", glow: "", border: "border-white/20 text-gray-300" };
                        const borderCol = style.border.split(" ")[0];
                        return (
                           <div className={`bg-linear-to-br ${style.gradient} border ${borderCol} ${style.glow} rounded-2xl p-4 flex flex-col gap-3 shadow-lg ring-1 ring-correct/15`}>
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
                        startMatchmaking={startMatchmaking}
                     />
                  </div>

                  <button
                     onClick={() => { useLiveStore.getState().setCategory(lastCategoryRef.current); startMatchmaking(); }}
                     className="w-full bg-correct hover:bg-correct/90 text-black font-black uppercase py-4 rounded-2xl flex items-center justify-center gap-2 tracking-widest shadow-[0_4px_20px_rgba(46,204,113,0.3)] cursor-pointer hover:scale-102 active:scale-98 transition-all"
                  >
                     <Swords size={16} /> Search Opponent
                  </button>
               </motion.div>
            )}

            {activeTab === "rankings" && (
               <motion.div
                  key="rankings-tab"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-4"
               >
                  <RankingView currentUser={currentUser} userStats={userStats} />
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
                        <Loader2 className="w-6 h-6 text-correct animate-spin" />
                     </div>
                  ) : historyMatches.length > 0 ? (
                     <div className="space-y-2">
                        {historyMatches.map((match) => {
                           const isP1 = match.player1_id === currentUser?.id;
                           const oppProfile = isP1 ? match.player2 : match.player1;
                           const myScore = isP1 ? match.p1_score || 0 : match.p2_score || 0;
                           const oppScore = isP1 ? match.p2_score || 0 : match.p1_score || 0;
                           const oppName = match.is_bot_match ? "Word Bot" : (oppProfile?.username || "Opponent");

                           let outcome = "DRAW";
                           let outcomeColor = "text-gray-400 bg-gray-500/10 border-gray-500/20";
                           if (myScore > oppScore) {
                              outcome = "WIN";
                              outcomeColor = "text-correct bg-correct/10 border-correct/20";
                           } else if (oppScore > myScore) {
                              outcome = "LOSS";
                              outcomeColor = "text-red-400 bg-red-500/10 border-red-500/20";
                           }

                           const dateStr = new Date(match.completed_at || match.created_at).toLocaleDateString(undefined, {
                              month: 'short',
                              day: 'numeric'
                           });

                           const seenMatchesStr = safeLocalStorage.getItem("wordup_seen_matches");
                           let isNew = false;
                           try {
                              const seen = seenMatchesStr ? JSON.parse(seenMatchesStr) : [];
                              isNew = !seen.includes(match.id);
                           } catch {
                              // ignore JSON parse errors
                           }

                           return (
                              <div
                                 key={match.id}
                                 onClick={() => onSelectHistoryMatch?.(match)}
                                 className={`hover:bg-correct/10 rounded-2xl p-3.5 flex items-center justify-between text-xs cursor-pointer active:scale-98 transition-all ${isNew ? "bg-correct/10 border border-correct/30 shadow-[0_0_12px_rgba(46,204,113,0.1)] hover:border-correct/50" : "bg-correct/5 border border-correct/10 hover:border-correct/20"}`}
                              >
                                 <div className="min-w-0">
                                    <div className="flex items-center gap-2">
                                       <p className="font-black text-white truncate">vs {oppName}</p>
                                       {isNew && (
                                          <span className="text-[7.5px] font-black uppercase text-correct bg-correct/10 border border-correct/25 px-1.5 py-0.5 rounded-md tracking-wider animate-pulse">
                                             NEW
                                          </span>
                                       )}
                                    </div>
                                    <p className="text-[9px] text-gray-500 font-bold uppercase mt-0.5">{match.category.replace('_', ' ')} • {dateStr}</p>
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

         <div className="bg-correct/5 border border-correct/10 rounded-2xl overflow-hidden transition-all duration-300">
            <button
               onClick={() => setShowHelp(!showHelp)}
               className="w-full flex items-center justify-between p-4 text-xs font-black uppercase tracking-wider text-gray-300 hover:text-white transition-colors cursor-pointer"
            >
               <div className="flex items-center gap-2">
                  <HelpCircle size={14} className="text-correct" />
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
                        <p>You and your opponent answer the same 7 questions simultaneously. Both players must submit their answer before the next round begins, or wait for the timer to expire.</p>
                     </div>
                     <div>
                        <p className="font-black text-white uppercase tracking-wider mb-1">Scoring System</p>
                        <ul className="list-disc pl-4 space-y-1">
                           <li><strong className="text-correct">Correct answer</strong>: <strong className="text-white">11–20 points</strong> (decays over time with a 1.5s grace period).</li>
                           <li><strong className="text-correct">Speed Bonus</strong>: Faster answers earn more — the 20-point max drops to 11 at the time limit.</li>
                           <li><strong className="text-pink-500">Round 7 (Final Round)</strong>: All points are <strong className="text-pink-500">DOUBLED</strong>! Make it count!</li>
                        </ul>
                     </div>
                     <div>
                        <p className="font-black text-white uppercase tracking-wider mb-1">Question Types</p>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                           <div className="bg-correct/5 p-2 rounded-lg">
                              <strong className="text-white block text-[10px]">Anagrams</strong> Scramble letters back into a word.
                           </div>
                           <div className="bg-correct/5 p-2 rounded-lg">
                              <strong className="text-white block text-[10px]">Definitions</strong> Match the word to its dictionary definition.
                           </div>
                           <div className="bg-correct/5 p-2 rounded-lg">
                              <strong className="text-white block text-[10px]">Reverse Wordle</strong> Guess the word that generated the pattern.
                           </div>
                           <div className="bg-correct/5 p-2 rounded-lg">
                              <strong className="text-white block text-[10px]">Real / Fake</strong> Spot authentic words vs fake mutations.
                           </div>
                           <div className="bg-correct/5 p-2 rounded-lg">
                              <strong className="text-white block text-[10px]">Missing Letter</strong> Complete the blank to spell a valid word.
                           </div>
                           <div className="bg-correct/5 p-2 rounded-lg">
                              <strong className="text-white block text-[10px]">Pattern Rules</strong> Answer True/False for letter conditions.
                           </div>
                        </div>
                     </div>
                  </motion.div>
               )}
            </AnimatePresence>
         </div>
      </motion.div>
   );
};
