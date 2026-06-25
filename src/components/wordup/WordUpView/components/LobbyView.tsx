/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Play, HelpCircle, ChevronDown, ChevronUp, Loader2, Send, Volume2, VolumeX, RotateCcw, } from "lucide-react";
import { CATEGORIES } from "../constants";
import { type ProfileStats } from "../types";
import { supabase } from "../../../../lib/supabaseClient";
import { useWordUpStore } from "../../../../store/useWordUpStore";
import { BOT_PROFILES } from "../../../../utils/wordupQuestionGenerator";
import { generateMatchQuestions } from "../../../../services/wordup/questionService";
import { useApp } from "../../../../context/AppContext";
import { safeLocalStorage } from "../../../../utils/storage";
import { CategorySelectModal, CATEGORY_STYLE_MAP } from "./CategorySelectModal";
import { RankingView } from "./RankingView";
import { ProtectedAvatar } from "../../../../components/chat/ProtectedAvatar";

interface LobbyViewProps {
   userStats: ProfileStats | null;
   category: string;
   setCategory: (cat: string) => void;
   startMatchmaking: () => void;
   getRankColor: (rankName: string) => string;
   onlineUsers: any[];
   allProfiles: any[];
   currentUser: any;
   onSelectHistoryMatch?: (match: any) => void;
   soundEnabled: boolean;
   onToggleSound: () => void;
   onPurgeAndReset: () => void;
   onBack?: () => void;
}

export const LobbyView = ({
   userStats,
   category,
   setCategory,
   startMatchmaking,
   getRankColor,
   onlineUsers,
   allProfiles,
   currentUser,
   onSelectHistoryMatch,
   soundEnabled,
   onToggleSound,
   onPurgeAndReset,
}: LobbyViewProps) => {
   const { triggerToast } = useApp();
   const [showHelp, setShowHelp] = useState(false);
   const [showCategoryModal, setShowCategoryModal] = useState(false);
   const [outgoingInvite, setOutgoingInvite] = useState<{ targetUserId: string; targetUsername: string } | null>(null);
   const timeoutRef = useRef<number | null>(null);
   const inviteResolvedRef = useRef(false);

   // New states for tabs and challenge matching
   const [activeTab, setActiveTab] = useState<"play" | "rankings" | "pending" | "history">("play");
   const [pendingMatches, setPendingMatches] = useState<any[]>([]);
   const [historyMatches, setHistoryMatches] = useState<any[]>([]);
   const [isLoadingData, setIsLoadingData] = useState(false);
   const [incomingOfflineOrTimeout, setIncomingOfflineOrTimeout] = useState<{ targetUser: any; type: "offline" | "timeout" } | null>(null);

   useEffect(() => {
      const handleRejected = (e: Event) => {
         if (inviteResolvedRef.current) return;
         inviteResolvedRef.current = true;
         const detail = (e as CustomEvent)?.detail;
         setOutgoingInvite(null);
         window.dispatchEvent(new CustomEvent("MascoChanged", {
            detail: { mascotFace: "(︶︿︶)", mascotLabel: `${detail?.senderName || "Opponent"} declined your invite.` }
         }));
         if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
         }
      };

      const handleBusy = () => {
         if (inviteResolvedRef.current) return;
         inviteResolvedRef.current = true;
         setOutgoingInvite(null);
         if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
         }
      };

      const handleAccepted = (e: Event) => {
         if (inviteResolvedRef.current) return;
         inviteResolvedRef.current = true;
         const detail = (e as CustomEvent)?.detail;
         setOutgoingInvite(null);
         setIncomingOfflineOrTimeout(null);
         if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
            timeoutRef.current = null;
         }
         triggerToast(`${detail.senderName || "Opponent"} accepted! Starting match...`, 3000);
         // Transition to match
          useWordUpStore.getState().setMatchId(detail.matchId);
          useWordUpStore.getState().setRole("player1");
          useWordUpStore.getState().setView("loading");
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
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   // Track completed match IDs to avoid duplicate notifications
   const NOTIFIED_KEY = 'wordup_completed_notified';
   const NOTIFIED_TS_KEY = 'wordup_completed_notified_timestamps';

   const loadNotifiedState = (): { ids: Set<string>; timestamps: Record<string, number> } => {
      try {
         const stored = safeLocalStorage.getItem(NOTIFIED_KEY);
         const tsStored = safeLocalStorage.getItem(NOTIFIED_TS_KEY);
         const ids = stored ? new Set<string>(JSON.parse(stored)) : new Set<string>();
         const timestamps: Record<string, number> = tsStored ? JSON.parse(tsStored) : {};
         const cutoff = Date.now() - 48 * 60 * 60 * 1000;
         const cleanedIds = new Set<string>();
         const cleanedTimestamps: Record<string, number> = {};
         for (const id of ids) {
            const ts = timestamps[id];
            if (ts && ts >= cutoff) {
               cleanedIds.add(id);
               cleanedTimestamps[id] = ts;
            }
         }
         if (cleanedIds.size !== ids.size) {
            safeLocalStorage.setItem(NOTIFIED_KEY, JSON.stringify([...cleanedIds]));
            safeLocalStorage.setItem(NOTIFIED_TS_KEY, JSON.stringify(cleanedTimestamps));
         }
         return { ids: cleanedIds, timestamps: cleanedTimestamps };
      } catch { return { ids: new Set(), timestamps: {} }; }
   };

   const [notifiedState, setNotifiedState] = useState(() => loadNotifiedState());
   const notifiedCompleted = notifiedState.ids;
   const notifiedTimestamps = notifiedState.timestamps;
   void notifiedTimestamps;
   const notifiedCompletedRef = useRef(notifiedCompleted);
   useEffect(() => {
      notifiedCompletedRef.current = notifiedCompleted;
   }, [notifiedCompleted]);

   const persistNotifiedState = (ids: Set<string>, timestamps: Record<string, number>) => {
      try {
         safeLocalStorage.setItem(NOTIFIED_KEY, JSON.stringify([...ids]));
         safeLocalStorage.setItem(NOTIFIED_TS_KEY, JSON.stringify(timestamps));
      } catch { /* ignore */ }
   };

   const markNotified = useCallback((id: string) => {
      setNotifiedState((prev) => {
         const newIds = new Set(prev.ids);
         const newTimestamps = { ...prev.timestamps };
         newIds.add(id);
         newTimestamps[id] = Date.now();
         notifiedCompletedRef.current = newIds;
         persistNotifiedState(newIds, newTimestamps);
         return { ids: newIds, timestamps: newTimestamps };
      });
   }, []);

   const fetchPendingMatches = useCallback(async () => {
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
            .or(`player1_id.eq.${currentUser.id},player2_id.eq.${currentUser.id}`)
            .in("status", ["waiting", "completed"])
            .order("created_at", { ascending: false });

         if (error) throw error;

         const now = new Date();
         const activePending: any[] = [];

         for (const m of (data || [])) {
            const createdAt = new Date(m.created_at);
            const diffHrs = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);

            if (m.status === "completed") {
               const isP1 = m.player1_id === currentUser.id;
               const iPlayed = isP1 ? m.p1_answered : m.p2_answered;
               const oppPlayed = isP1 ? m.p2_answered : m.p1_answered;

                if (iPlayed && oppPlayed && !m.is_bot_match && !notifiedCompletedRef.current.has(m.id)) {
                   markNotified(m.id);
                }
               continue;
            }

            if (diffHrs >= 24) {
               await supabase
                  .from("wordup_matches")
                  .update({
                     status: "completed",
                     p1_answered: true,
                     p2_answered: true,
                     completed_at: now.toISOString()
                  })
                  .eq("id", m.id);
            } else {
               activePending.push(m);
            }
         }

         setPendingMatches(activePending);
      } catch (e) {
         console.error("Failed to fetch pending matches:", e);
      } finally {
         setIsLoadingData(false);
      }
   }, [currentUser, markNotified]);

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

   // Fetch data when activeTab changes or currentUser updates
   useEffect(() => {
      let active = true;
      const timer = setTimeout(() => {
         if (active) {
            if (activeTab === "history") {
               fetchHistory();
            } else if (activeTab === "pending") {
               fetchPendingMatches();
            }
         }
      }, 0);
      return () => {
         active = false;
         clearTimeout(timer);
      };
   }, [activeTab, currentUser?.id, fetchHistory, fetchPendingMatches]);

   // Always fetch pending matches when currentUser is available, to pre-populate the bg queue
   useEffect(() => {
      if (!currentUser?.id) return;
      let active = true;
      const timer = setTimeout(() => {
         if (active) {
            fetchPendingMatches();
         }
      }, 0);
      return () => {
         active = false;
         clearTimeout(timer);
      };
   }, [currentUser?.id, fetchPendingMatches]);

   // Realtime listener for pending matches updates
   useEffect(() => {
      if (!currentUser?.id) return;

      const channelName = `wordup_matches_lobby_${currentUser.id}`;
      const existingChannel = supabase
         .getChannels()
         .find((c) => (c as any).topic === `realtime:${channelName}`);
      if (existingChannel) {
         supabase.removeChannel(existingChannel);
      }

      const handleMatchChange = (payload: any) => {
         const match = payload.new;
         if (!match || match.status !== "completed") {
            fetchPendingMatches();
            return;
         }

         const isUserMatch =
            match.player1_id === currentUser?.id ||
            match.player2_id === currentUser?.id;
         if (!isUserMatch) {
            fetchPendingMatches();
            return;
         }

         if (notifiedCompletedRef.current.has(match.id)) {
            fetchPendingMatches();
            return;
         }
         markNotified(match.id);

         const isP1 = match.player1_id === currentUser?.id;
         const iPlayed = isP1 ? match.p1_answered : match.p2_answered;
         const oppPlayed = isP1 ? match.p2_answered : match.p1_answered;

         if (iPlayed && oppPlayed && match.status === "completed" && !match.is_bot_match) {
            triggerToast("Your opponent completed their turn! Check the results.", 6000);
         }

         fetchPendingMatches();
      };

      const channel = supabase
         .channel(channelName)
         .on(
            "postgres_changes",
            {
               event: "*",
               schema: "public",
               table: "wordup_matches",
               filter: `player1_id=eq.${currentUser.id}`
            },
            handleMatchChange
         )
         .on(
            "postgres_changes",
            {
               event: "*",
               schema: "public",
               table: "wordup_matches",
               filter: `player2_id=eq.${currentUser.id}`
            },
            handleMatchChange
         )
         .subscribe();

      return () => {
         supabase.removeChannel(channel);
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [currentUser?.id]);

   const createPendingMatchAndNotification = async (targetUser: any) => {
      if (!currentUser?.id || !targetUser?.id || currentUser.id === targetUser.id) {
         console.error("Invalid IDs or challenging self");
         return null;
      }
      try {
         // Dedup: check if a match already exists between these two users
         const { data: existing } = await supabase
            .from("wordup_matches")
            .select("id")
            .or(`and(player1_id.eq.${currentUser.id},player2_id.eq.${targetUser.id}),and(player1_id.eq.${targetUser.id},player2_id.eq.${currentUser.id})`)
            .in("status", ["waiting", "countdown"])
            .limit(1);

         if (existing && existing.length > 0) {
            return existing[0].id;
         }

         const { data: newMatch, error } = await supabase
            .from("wordup_matches")
            .insert({
               category: category,
               player1_id: currentUser.id,
               player2_id: targetUser.id,
               status: "waiting",
               game_type: "async",
               p1_answered: false,
               p2_answered: false,
               question_started_at: new Date().toISOString()
            })
            .select()
            .single();

         if (error || !newMatch) throw error || new Error("Failed to create match");

         // Generate questions — await so they're ready before caller navigates to the match
         await generateMatchQuestions(newMatch.id, category);

         return newMatch.id;
      } catch (e) {
         console.error("Failed to create pending match/notification:", e);
         return null;
      }
   };

   const handleSendInvite = (targetUser: any) => {
      if (!currentUser) {
         window.dispatchEvent(new CustomEvent("open-auth-modal"));
         return;
      }
      if (targetUser.id === currentUser.id) {
         triggerToast("You cannot challenge yourself!", 3000);
         return;
      }

      // Check if targetUser is online
      const isOnline = onlineUsers && onlineUsers.some((u) => u.id === targetUser.id);
      if (!isOnline) {
         setIncomingOfflineOrTimeout({ targetUser, type: "offline" });
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
         if (inviteResolvedRef.current) return;
         setOutgoingInvite((prev) => {
            if (prev) {
               setIncomingOfflineOrTimeout({ targetUser, type: "timeout" });
            }
            return null;
         });
      }, 15000);
   };

    const handlePlayMyTurn = (match: any) => {
       const role = match.player1_id === currentUser.id ? "player1" : "player2";
       useWordUpStore.getState().setMatchId(match.id);
       useWordUpStore.getState().setRole(role);
       useWordUpStore.getState().setView("loading");
    };

   return (
      <motion.div
         initial={{ opacity: 0, y: 15 }}
         animate={{ opacity: 1, y: 0 }}
         exit={{ opacity: 0, y: -15 }}
         className="flex flex-col gap-4 md:gap-6 flex-1 justify-center py-1 md:py-2"
      >
         <div className="space-y-1 relative text-center">
            <div className="flex items-center justify-between gap-4 px-2 shrink-0">

               <h2 className="text-2xl font-black uppercase tracking-wider text-white">WordUp Battles (Beta)</h2>
               {/* Right side Sound & Reset controls */}
               <div className="flex items-center gap-2 w-[84px] justify-end">
                  <button
                     onClick={onToggleSound}
                     className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-all cursor-pointer"
                     title="Toggle Sound"
                  >
                     {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
                  </button>
                  <button
                     onClick={onPurgeAndReset}
                     className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-red-400 transition-all cursor-pointer"
                     title="Reset Game State"
                  >
                     <RotateCcw size={15} />
                  </button>
               </div>
            </div>

         </div>

         {/* Segmented Tab Bar */}
         <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 shrink-0">
            {(["play", "rankings", "pending", "history"] as const).map((tab) => (
               <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 text-[10px] font-black uppercase py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === tab
                     ? "bg-correct text-black shadow-md font-black"
                     : "text-gray-400 hover:text-white"
                     }`}
               >
                  {tab === "play" ? "Play" : tab === "rankings" ? "Rankings" : tab === "pending" ? `Pending (${pendingMatches.length})` : "History"}
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
                     <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">Active Arena Category</p>
                     {(() => {
                        const activeCatObj = CATEGORIES.find(c => c.id === category) || CATEGORIES[0];
                        const style = CATEGORY_STYLE_MAP[activeCatObj.id] || { emoji: "💡", gradient: "from-slate-950/40 via-slate-900/30 to-slate-950/40", glow: "", border: "border-white/20 text-gray-300" };
                        const borderCol = style.border.split(" ")[0];
                        return (
                           <div className={`bg-linear-to-br ${style.gradient} border ${borderCol} ${style.glow} rounded-2xl p-4 flex flex-col gap-3 shadow-lg ring-1 ring-white/10`}>
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
                        setCategory={setCategory}
                        startMatchmaking={startMatchmaking}
                     />
                  </div>

                  <button
                     onClick={startMatchmaking}
                     className="w-full bg-correct hover:bg-correct/90 text-black font-black uppercase py-4 rounded-2xl flex items-center justify-center gap-2 tracking-widest shadow-[0_4px_20px_rgba(46,204,113,0.3)] cursor-pointer hover:scale-102 active:scale-98 transition-all"
                  >
                     <Play size={16} fill="black" /> Search Opponent
                  </button>

                  <div className="space-y-3">
                      <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                           Challenge Players
                        </p>
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                           {(() => {
                              const otherOnline = (onlineUsers || []).filter((u) => u.id !== currentUser?.id);
                              const displayUsers = (allProfiles || [])
                                 .filter((u) => u.id !== currentUser?.id)
                                 .sort((a, b) => {
                                    const aOnline = otherOnline.some(u => u.id === a.id);
                                    const bOnline = otherOnline.some(u => u.id === b.id);
                                    if (aOnline && !bOnline) return -1;
                                    if (!aOnline && bOnline) return 1;
                                    return new Date(b.last_seen_at || 0).getTime() - new Date(a.last_seen_at || 0).getTime();
                                 })
                                 .slice(0, 10);

                           if (displayUsers.length > 0) {
                              return (
                                 <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-hide">
                                    {displayUsers.map((opp) => {
                                       const isOnline = otherOnline.some(u => u.id === opp.id);
                                       return (
                                          <div key={opp.id} className="flex items-center justify-between bg-white/5 p-2.5 rounded-xl border border-white/5 animate-in fade-in duration-200">
                                             <div className="flex items-center gap-2 min-w-0">
                                                <ProtectedAvatar
                                                   userId={opp.id}
                                                   src={opp.avatar_url}
                                                   username={opp.username}
                                                   className="w-7 h-7 rounded-full border border-white/10 shrink-0"
                                                />
                                                <div className="flex flex-col min-w-0">
                                                   <div className="flex items-center gap-1.5 min-w-0">
                                                      <span className="text-xs font-black text-white truncate">{opp.username}</span>
                                                      {isOnline && <span className="w-1.5 h-1.5 rounded-full bg-correct animate-pulse shrink-0" />}
                                                   </div>
                                                   {!isOnline && opp.last_seen_at && (
                                                      <span className="text-[8px] text-gray-500 font-bold uppercase truncate">
                                                         Seen {new Date(opp.last_seen_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                                      </span>
                                                   )}
                                                </div>
                                             </div>
                                             <button
                                                onClick={() => handleSendInvite(opp)}
                                                disabled={outgoingInvite !== null}
                                                className={`flex items-center gap-1.5 border text-[10px] font-black uppercase px-3 py-1.5 rounded-xl transition-all cursor-pointer active:scale-95 disabled:opacity-50 ${isOnline
                                                   ? "bg-correct/10 hover:bg-correct text-correct hover:text-black border-correct/20"
                                                   : "bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white border-white/10"
                                                   }`}
                                             >
                                                {isOnline ? <Send size={10} /> : <Swords size={10} />}
                                                {isOnline ? "Invite" : "Challenge"}
                                             </button>
                                          </div>
                                       );
                                    })}
                                 </div>
                              );
                           }

                           return <p className="text-[10px] text-gray-500 text-center py-2">No other players found.</p>;
                        })()}
                     </div>
                  </div>
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
                        <Loader2 className="w-6 h-6 text-correct animate-spin" />
                     </div>
                  ) : pendingMatches.length > 0 ? (
                     <div className="space-y-2.5">
                        {pendingMatches.map((match) => {
                           const isP1 = match.player1_id === currentUser?.id;
                           const oppProfile = isP1 ? match.player2 : match.player1;
                           const hasPlayed = isP1 ? match.p1_answered : match.p2_answered;
                           const oppName = match.is_bot_match ? (BOT_PROFILES[match.bot_profile]?.name || "Word Bot") : (oppProfile?.username || "Opponent");
                           const hoursLeft = Math.max(1, Math.round(24 - (new Date().getTime() - new Date(match.created_at).getTime()) / (1000 * 60 * 60)));
                           const catObj = CATEGORIES.find(c => c.id === match.category);
                           const categoryName = catObj ? catObj.name : match.category.replace('_', ' ');

                           return (
                              <div key={match.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3">
                                 <div className="flex items-center gap-3 min-w-0">
                                    <ProtectedAvatar
                                       userId={match.is_bot_match ? undefined : (isP1 ? match.player2_id : match.player1_id)}
                                       src={match.is_bot_match ? undefined : oppProfile?.avatar_url}
                                       username={oppName}
                                       className="w-9 h-9 rounded-full border border-white/10 shrink-0"
                                    />
                                    <div className="min-w-0">
                                       <p className="text-xs font-black text-white truncate">vs {oppName}</p>
                                       <div className="flex items-center gap-1.5 mt-1">
                                          <span className="text-[8.5px] font-black text-cyan-400 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-md uppercase tracking-wider shrink-0">
                                             {categoryName}
                                          </span>
                                          <span className="text-[9px] text-gray-500 font-bold uppercase shrink-0">
                                             • {hoursLeft}h left
                                          </span>
                                       </div>
                                    </div>
                                 </div>
                                 {hasPlayed ? (
                                    <span className="text-[9px] font-black uppercase text-amber-500 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-xl">
                                       Waiting
                                    </span>
                                 ) : (
                                    <button
                                       onClick={() => handlePlayMyTurn(match)}
                                       className="bg-correct hover:bg-correct/90 text-black text-[10px] font-black uppercase px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                                    >
                                       Play Turn
                                    </button>
                                 )}
                              </div>
                           );
                        })}
                     </div>
                  ) : (
                     <div className="text-center py-12 text-gray-500 space-y-2">
                        <Swords size={24} className="mx-auto text-gray-600 animate-pulse" />
                        <p className="text-[10px] uppercase font-black tracking-wider">No pending challenges</p>
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
                        <Loader2 className="w-6 h-6 text-correct animate-spin" />
                     </div>
                  ) : historyMatches.length > 0 ? (
                     <div className="space-y-2">
                        {historyMatches.map((match) => {
                           const isP1 = match.player1_id === currentUser?.id;
                           const oppProfile = isP1 ? match.player2 : match.player1;
                           const myScore = isP1 ? match.p1_score || 0 : match.p2_score || 0;
                           const oppScore = isP1 ? match.p2_score || 0 : match.p1_score || 0;
                           const oppName = match.is_bot_match ? (BOT_PROFILES[match.bot_profile]?.name || "Word Bot") : (oppProfile?.username || "Opponent");

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
                                 className={`hover:bg-white/10 rounded-2xl p-3.5 flex items-center justify-between text-xs cursor-pointer active:scale-98 transition-all ${isNew ? "bg-correct/5 border border-correct/30 shadow-[0_0_12px_rgba(46,204,113,0.1)] hover:border-correct/50" : "bg-white/5 border border-white/10 hover:border-white/20"}`}
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
                        inviteResolvedRef.current = true;
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

         {/* Offline / Timeout popup choice modal */}
         {incomingOfflineOrTimeout && (
            <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
               <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl text-center space-y-4 flex flex-col items-center">
                  <div className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 text-indigo-400">
                     <Swords size={24} />
                  </div>
                  <div>
                     <h3 className="text-sm font-black uppercase tracking-wider text-white">
                        {incomingOfflineOrTimeout.type === "offline" ? "Player Offline" : "No Response"}
                     </h3>
                     <p className="text-[10px] text-gray-400 mt-1">
                        {incomingOfflineOrTimeout.type === "offline" ? (
                           <>
                              <strong className="text-white">{incomingOfflineOrTimeout.targetUser.username}</strong> is offline.
                           </>
                        ) : (
                           <>
                              <strong className="text-white">{incomingOfflineOrTimeout.targetUser.username}</strong> did not respond within 15 seconds.
                           </>
                        )} This game will be automatically pending.
                     </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 w-full">
                     <button
                        onClick={async () => {
                           if (inviteResolvedRef.current) {
                              setIncomingOfflineOrTimeout(null);
                              return;
                           }
                           inviteResolvedRef.current = true;
                           const target = incomingOfflineOrTimeout.targetUser;
                           useWordUpStore.getState().setView("loading");
                           const mId = await createPendingMatchAndNotification(target);
                           setIncomingOfflineOrTimeout(null);
                           if (mId) {
                              useWordUpStore.getState().setMatchId(mId);
                              useWordUpStore.getState().setRole("player1");
                           } else {
                              useWordUpStore.getState().setView("menu");
                           }
                        }}
                        className="bg-correct hover:bg-correct/90 text-black text-[10px] font-black uppercase py-3 rounded-xl transition-all active:scale-95 cursor-pointer"
                     >
                        Play Mine Now
                     </button>
                     <button
                        onClick={async () => {
                           if (inviteResolvedRef.current) {
                              setIncomingOfflineOrTimeout(null);
                              return;
                           }
                           inviteResolvedRef.current = true;
                           const target = incomingOfflineOrTimeout.targetUser;
                           await createPendingMatchAndNotification(target);
                           setIncomingOfflineOrTimeout(null);
                           fetchPendingMatches();
                           setActiveTab("pending");
                        }}
                        className="bg-white/5 hover:bg-white/10 border border-white/10 text-white text-[10px] font-black uppercase py-3 rounded-xl transition-all active:scale-95 cursor-pointer"
                     >
                        Wait
                     </button>
                  </div>
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
