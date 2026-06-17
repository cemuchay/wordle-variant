import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Play, Volume2, VolumeX, HelpCircle, ChevronDown, ChevronUp, Loader2, Send } from "lucide-react";
import { CATEGORIES } from "../constants";
import { type ProfileStats } from "../types";
import { supabase } from "../../../../lib/supabaseClient";
import { useWordUpStore } from "../../../../store/useWordUpStore";

interface LobbyViewProps {
   userStats: ProfileStats | null;
   category: string;
   setCategory: (cat: string) => void;
   startMatchmaking: () => void;
   getRankColor: (rankName: string) => string;
   soundEnabled: boolean;
   onToggleSound: () => void;
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   onlineUsers: any[];
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   currentUser: any;
}

export const LobbyView = ({
   userStats,
   category,
   setCategory,
   startMatchmaking,
   getRankColor,
   soundEnabled,
   onToggleSound,
   onlineUsers,
   currentUser
}: LobbyViewProps) => {
   const [showHelp, setShowHelp] = useState(false);
   const [outgoingInvite, setOutgoingInvite] = useState<{ targetUserId: string; targetUsername: string } | null>(null);
   const timeoutRef = useRef<number | null>(null);

   useEffect(() => {
      const handleRejected = (e: Event) => {
         const detail = (e as CustomEvent)?.detail;
         setOutgoingInvite((prev) => {
            if (prev) {
               window.dispatchEvent(new CustomEvent("MascoChanged", {
                  detail: { mascotFace: "(︶︿︶)", mascotLabel: `${detail?.senderName || "Opponent"} declined your invite.` }
               }));
            }
            return null;
         });
         if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
         }
      };

      const handleBusy = () => {
         setOutgoingInvite((prev) => {
            if (prev) {
               window.dispatchEvent(new CustomEvent("MascoChanged", {
                  detail: { mascotFace: "(•_•)", mascotLabel: `${prev.targetUsername} is currently busy.` }
               }));
            }
            return null;
         });
         if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
         }
      };

      const handleAccepted = (e: Event) => {
         const detail = (e as CustomEvent)?.detail;
         setOutgoingInvite(null);
         if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
         }
         // Transition to match
         useWordUpStore.getState().setMatchId(detail.matchId);
         useWordUpStore.getState().setRole("player1");
      };

      window.addEventListener("wordup-invite-rejected", handleRejected);
      window.addEventListener("wordup-invite-busy", handleBusy);
      window.addEventListener("wordup-invite-accepted", handleAccepted);

      return () => {
         window.removeEventListener("wordup-invite-rejected", handleRejected);
         window.removeEventListener("wordup-invite-busy", handleBusy);
         window.removeEventListener("wordup-invite-accepted", handleAccepted);
         if (timeoutRef.current) clearTimeout(timeoutRef.current);
      };
   }, []);

   // eslint-disable-next-line @typescript-eslint/no-explicit-any
   const handleSendInvite = (targetUser: any) => {
      if (!currentUser) {
         window.dispatchEvent(new CustomEvent("open-auth-modal"));
         return;
      }

      setOutgoingInvite({ targetUserId: targetUser.id, targetUsername: targetUser.username });

      // Send the broadcast
      const targetChannel = supabase.channel(`user_signals_${targetUser.id}`);
      targetChannel.subscribe((status) => {
         if (status === "SUBSCRIBED") {
            targetChannel.send({
               type: "broadcast",
               event: "wordup_invite",
               payload: {
                  senderId: currentUser.id,
                  senderName: currentUser.user_metadata?.username || currentUser.email?.split("@")[0] || "Someone",
                  category: category
               }
            });
            // Cleanup one-shot channel
            setTimeout(() => supabase.removeChannel(targetChannel), 1000);
         }
      });

      // 15 seconds ring timeout
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = window.setTimeout(() => {
         setOutgoingInvite((prev) => {
            if (prev) {
               window.dispatchEvent(new CustomEvent("MascoChanged", {
                  detail: { mascotFace: "(•_•)", mascotLabel: `Invitation to ${prev.targetUsername} timed out.` }
               }));
            }
            return null;
         });
      }, 15000);
   };

   return (
      <motion.div
         initial={{ opacity: 0, y: 15 }}
         animate={{ opacity: 1, y: 0 }}
         exit={{ opacity: 0, y: -15 }}
         className="flex flex-col gap-6 flex-1 justify-center py-6"
      >
         <div className="text-center space-y-2 relative">
            <button
               onClick={onToggleSound}
               className="absolute right-0 top-0 p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
               title="Toggle Sound"
            >
               {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            <div className="inline-flex p-4 bg-correct/10 rounded-3xl border border-correct/20 text-correct shadow-[0_0_20px_rgba(46,204,113,0.15)] animate-pulse">
               <Swords size={32} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-wider text-white">WordUp Battles</h2>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
               Test your word speed & pattern skills in a head-to-head 7-question rapid match!
            </p>
         </div>

         {userStats && (
            <div className="grid grid-cols-3 bg-white/5 border border-white/10 rounded-2xl p-4 text-center">
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
            <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Select Category</p>
            <div className="grid grid-cols-1 gap-2">
               {CATEGORIES.map((cat) => (
                  <button
                     key={cat.id}
                     onClick={() => setCategory(cat.id)}
                     className={`flex flex-col items-start p-3.5 rounded-xl border text-left transition-all ${category === cat.id
                        ? "bg-correct/10 border-correct text-white shadow-[0_0_15px_rgba(46,204,113,0.1)]"
                        : "bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:border-white/20"
                        }`}
                  >
                     <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${category === cat.id ? "bg-correct" : "bg-gray-600"}`} />
                        <p className="text-xs font-black uppercase tracking-wider text-white">{cat.name}</p>
                     </div>
                     <p className="text-[9px] text-gray-500 mt-1">{cat.desc}</p>
                  </button>
               ))}
            </div>
         </div>

         <button
            onClick={startMatchmaking}
            className="w-full bg-correct hover:bg-correct/90 text-black font-black uppercase py-4 rounded-2xl flex items-center justify-center gap-2 tracking-widest shadow-[0_4px_20px_rgba(46,204,113,0.3)] cursor-pointer hover:scale-102 active:scale-98 transition-all"
         >
            <Play size={16} fill="black" /> Search Opponent
         </button>

         {/* Direct Invite Online Players Section */}
         <div className="space-y-3">
            <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Invite Online Players</p>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
               {onlineUsers && onlineUsers.filter((u) => u.id !== currentUser?.id).length > 0 ? (
                  <div className="space-y-2 max-h-[160px] overflow-y-auto scrollbar-hide">
                     {onlineUsers
                        .filter((u) => u.id !== currentUser?.id)
                        .map((opp) => (
                           <div key={opp.id} className="flex items-center justify-between bg-white/5 p-2.5 rounded-xl border border-white/5 animate-in fade-in duration-200">
                              <div className="flex items-center gap-2 min-w-0">
                                 <img
                                    src={opp.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${opp.username}`}
                                    alt={opp.username}
                                    className="w-7 h-7 rounded-full border border-white/10 shrink-0"
                                 />
                                 <span className="text-xs font-black text-white truncate max-w-[120px]">{opp.username}</span>
                                 <span className="w-1.5 h-1.5 rounded-full bg-correct animate-pulse shrink-0" />
                              </div>
                              <button
                                 onClick={() => handleSendInvite(opp)}
                                 disabled={outgoingInvite !== null}
                                 className="flex items-center gap-1.5 bg-correct/10 hover:bg-correct text-correct hover:text-black border border-correct/20 text-[10px] font-black uppercase px-3 py-1.5 rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                              >
                                 <Send size={10} />
                                 Invite
                              </button>
                           </div>
                        ))}
                  </div>
               ) : (
                  <p className="text-[10px] text-gray-500 text-center py-2">No other players online right now.</p>
               )}
            </div>
         </div>

         {outgoingInvite && (
            <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="w-full max-w-xs bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4 flex flex-col items-center">
                  <Loader2 className="w-8 h-8 text-correct animate-spin" />
                  <div>
                     <h3 className="text-sm font-black uppercase tracking-wider text-white">Challenging Player</h3>
                     <p className="text-[10px] text-gray-400 mt-1">
                        Waiting for <strong className="text-white">{outgoingInvite.targetUsername}</strong> to accept your invite...
                     </p>
                  </div>
                  <button
                     onClick={() => {
                        setOutgoingInvite(null);
                        if (timeoutRef.current) clearTimeout(timeoutRef.current);
                     }}
                     className="w-full bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase py-2.5 rounded-xl transition-all cursor-pointer"
                  >
                     Cancel Challenge
                  </button>
               </div>
            </div>
         )}

         {/* Collapsible Help Section */}
         <div className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all duration-300">
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
                           <li><strong className="text-correct">Correct answer</strong>: Base 100 points + up to 50 points speed bonus.</li>
                           <li><strong className="text-correct">Speed Bonus</strong>: Faster submissions receive more bonus points (decaying from +50 to +0 over the question duration).</li>
                           <li><strong className="text-pink-500">Round 7 (Final Round)</strong>: All points are <strong className="text-pink-500">DOUBLED</strong>! Make it count!</li>
                        </ul>
                     </div>
                     <div>
                        <p className="font-black text-white uppercase tracking-wider mb-1">Question Types</p>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                           <div className="bg-white/5 p-2 rounded-lg">
                              <strong className="text-white block text-[10px]">Anagrams</strong> Scramble letters back into a word.
                           </div>
                           <div className="bg-white/5 p-2 rounded-lg">
                              <strong className="text-white block text-[10px]">Definitions</strong> Match the word to its dictionary definition.
                           </div>
                           <div className="bg-white/5 p-2 rounded-lg">
                              <strong className="text-white block text-[10px]">Reverse Wordle</strong> Guess the word that generated the pattern.
                           </div>
                           <div className="bg-white/5 p-2 rounded-lg">
                              <strong className="text-white block text-[10px]">Real / Fake</strong> Spot authentic words vs fake mutations.
                           </div>
                           <div className="bg-white/5 p-2 rounded-lg">
                              <strong className="text-white block text-[10px]">Missing Letter</strong> Complete the blank to spell a valid word.
                           </div>
                           <div className="bg-white/5 p-2 rounded-lg">
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
