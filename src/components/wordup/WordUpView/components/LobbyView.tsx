/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Play, Volume2, VolumeX, HelpCircle, ChevronDown, ChevronUp, Loader2, Send } from "lucide-react";
import { CATEGORIES } from "../constants";
import { type ProfileStats } from "../types";
import { supabase } from "../../../../lib/supabaseClient";
import { useWordUpStore } from "../../../../store/useWordUpStore";
import { generateWordUpQuestions, generateSecretKey, encryptQuestions } from "../../../../utils/wordupQuestionGenerator";
import { useApp } from "../../../../context/AppContext";
import { safeLocalStorage } from "../../../../utils/storage";

interface LobbyViewProps {
   userStats: ProfileStats | null;
   category: string;
   setCategory: (cat: string) => void;
   startMatchmaking: () => void;
   getRankColor: (rankName: string) => string;
   soundEnabled: boolean;
   onToggleSound: () => void;
   onlineUsers: any[];
   allProfiles: any[];
   currentUser: any;
   onSelectHistoryMatch?: (match: any) => void;
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
   allProfiles,
   currentUser,
   onSelectHistoryMatch
}: LobbyViewProps) => {
   const { triggerToast } = useApp();
   const [showHelp, setShowHelp] = useState(false);
   const [outgoingInvite, setOutgoingInvite] = useState<{ targetUserId: string; targetUsername: string } | null>(null);
   const timeoutRef = useRef<number | null>(null);

   // New states for tabs and challenge matching
   const [activeTab, setActiveTab] = useState<"play" | "pending" | "history">("play");
   const [pendingMatches, setPendingMatches] = useState<any[]>([]);
   const [historyMatches, setHistoryMatches] = useState<any[]>([]);
   const [isLoadingData, setIsLoadingData] = useState(false);
   const [incomingOfflineOrTimeout, setIncomingOfflineOrTimeout] = useState<{ targetUser: any; type: "offline" | "timeout" } | null>(null);

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

   // Fetch data when activeTab changes or currentUser updates
   useEffect(() => {
      if (activeTab === "history") {
         fetchHistory();
      } else if (activeTab === "pending") {
         fetchPendingMatches();
      }
   }, [activeTab, currentUser?.id]);

   // Always fetch pending matches when currentUser is available, to pre-populate the bg queue
   useEffect(() => {
      if (currentUser?.id) {
         fetchPendingMatches();
      }
   }, [currentUser?.id]);

   // Track completed match IDs to avoid duplicate notifications
   const NOTIFIED_KEY = 'wordup_completed_notified';
   const NOTIFIED_TS_KEY = 'wordup_completed_notified_timestamps';

   const loadNotifiedState = (): { ids: Set<string>; timestamps: Record<string, number> } => {
      try {
         const stored = safeLocalStorage.getItem(NOTIFIED_KEY);
         const tsStored = safeLocalStorage.getItem(NOTIFIED_TS_KEY);
         const ids = stored ? new Set(JSON.parse(stored)) : new Set();
         const timestamps: Record<string, number> = tsStored ? JSON.parse(tsStored) : {};
         const cutoff = Date.now() - 24 * 60 * 60 * 1000;
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
   const notifiedCompletedRef = useRef(notifiedCompleted);
   notifiedCompletedRef.current = notifiedCompleted;

   const persistNotifiedState = (ids: Set<string>, timestamps: Record<string, number>) => {
      try {
         safeLocalStorage.setItem(NOTIFIED_KEY, JSON.stringify([...ids]));
         safeLocalStorage.setItem(NOTIFIED_TS_KEY, JSON.stringify(timestamps));
      } catch { /* ignore */ }
   };

   const markNotified = (id: string) => {
      const newIds = new Set(notifiedCompleted);
      const newTimestamps = { ...notifiedTimestamps };
      newIds.add(id);
      newTimestamps[id] = Date.now();
      setNotifiedState({ ids: newIds, timestamps: newTimestamps });
      persistNotifiedState(newIds, newTimestamps);
   };

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

         if (iPlayed && oppPlayed && match.status === "completed") {
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

   const fetchPendingMatches = async () => {
      if (!currentUser) return;
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

               if (iPlayed && oppPlayed && !notifiedCompletedRef.current.has(m.id)) {
                  markNotified(m.id);
                  triggerToast("Your opponent completed their turn! Check the results.", 6000);
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
   };

   const fetchHistory = async () => {
      if (!currentUser) return;
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
   };

   const createPendingMatchAndNotification = async (targetUser: any) => {
      if (!currentUser?.id || !targetUser?.id || currentUser.id === targetUser.id) {
         console.error("Invalid IDs or challenging self");
         return null;
      }
      try {
         const rawQuestions = generateWordUpQuestions(category);
         const secretKey = generateSecretKey();
         const encryptedStr = encryptQuestions(rawQuestions, secretKey);

         // Create match in status "waiting"
         const { data: newMatch, error } = await supabase
            .from("wordup_matches")
            .insert({
               category: category,
               player1_id: currentUser.id,
               player2_id: targetUser.id,
               questions: encryptedStr,
               encryption_key: secretKey,
               status: "waiting",
               game_type: "async",
               p1_answered: false,
               p2_answered: false
            })
            .select()
            .single();

         if (error || !newMatch) throw error || new Error("Failed to create match");

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
   };

   return (
      <motion.div
         initial={{ opacity: 0, y: 15 }}
         animate={{ opacity: 1, y: 0 }}
         exit={{ opacity: 0, y: -15 }}
         className="flex flex-col gap-6 flex-1 justify-center py-6"
      >
         <div className="text-center space-y-2 relative">


            <div className="inline-flex p-4 bg-correct/10 rounded-3xl border border-correct/20 text-correct shadow-[0_0_20px_rgba(46,204,113,0.15)] animate-pulse">
               <Swords size={32} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-wider text-white">WordUp Battles (Beta)</h2>
            <p className="text-xs text-gray-400 max-w-xs mx-auto">
               Test your word speed & pattern skills in a head-to-head 7-question rapid match!
            </p>
         </div>

         {/* Segmented Tab Bar */}
         <div className="flex bg-white/5 p-1 rounded-2xl border border-white/10 shrink-0">
            {(["play", "pending", "history"] as const).map((tab) => (
               <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`flex-1 text-[10px] font-black uppercase py-2.5 rounded-xl transition-all cursor-pointer ${activeTab === tab
                        ? "bg-correct text-black shadow-md font-black"
                        : "text-gray-400 hover:text-white"
                     }`}
               >
                  {tab === "play" ? "Play" : tab === "pending" ? `Pending (${pendingMatches.length})` : "History"}
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

                  <div className="space-y-3">
                     <p className="text-[10px] font-black uppercase text-gray-500 tracking-wider">
                        {onlineUsers && onlineUsers.filter((u) => u.id !== currentUser?.id).length > 0
                           ? "Invite Online Players"
                           : "Challenge Players"}
                     </p>
                     <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
                        {(() => {
                           const otherOnline = (onlineUsers || []).filter((u) => u.id !== currentUser?.id);
                           const displayUsers = otherOnline.length > 0
                              ? otherOnline
                              : (allProfiles || [])
                                 .filter((u) => u.id !== currentUser?.id)
                                 .sort((a, b) => new Date(b.last_seen_at || 0).getTime() - new Date(a.last_seen_at || 0).getTime())
                                 .slice(0, 10);

                           if (displayUsers.length > 0) {
                              return (
                                 <div className="space-y-2 max-h-[220px] overflow-y-auto scrollbar-hide">
                                    {displayUsers.map((opp) => {
                                       const isOnline = otherOnline.some(u => u.id === opp.id);
                                       return (
                                          <div key={opp.id} className="flex items-center justify-between bg-white/5 p-2.5 rounded-xl border border-white/5 animate-in fade-in duration-200">
                                             <div className="flex items-center gap-2 min-w-0">
                                                <img
                                                   src={opp.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${opp.username}`}
                                                   alt={opp.username}
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
                           const oppName = oppProfile?.username || "Opponent";
                           const oppAvatar = oppProfile?.avatar_url || `https://api.dicebear.com/7.x/bottts/svg?seed=${oppName}`;

                           const hoursLeft = Math.max(1, Math.round(24 - (new Date().getTime() - new Date(match.created_at).getTime()) / (1000 * 60 * 60)));

                           return (
                              <div key={match.id} className="bg-white/5 border border-white/10 rounded-2xl p-4 flex items-center justify-between gap-3">
                                 <div className="flex items-center gap-3 min-w-0">
                                    <img src={oppAvatar} alt={oppName} className="w-9 h-9 rounded-full border border-white/10 shrink-0" />
                                    <div className="min-w-0">
                                       <p className="text-xs font-black text-white truncate">{oppName}</p>
                                       <p className="text-[9px] text-gray-500 uppercase font-bold mt-0.5">{match.category.replace('_', ' ')} • {hoursLeft}h left</p>
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
                           const oppName = oppProfile?.username || "Opponent";

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

                           return (
                              <div
                                 key={match.id}
                                 onClick={() => onSelectHistoryMatch?.(match)}
                                 className="bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl p-3.5 flex items-center justify-between text-xs cursor-pointer active:scale-98 transition-all hover:border-white/20"
                              >
                                 <div className="min-w-0">
                                    <p className="font-black text-white truncate">vs {oppName}</p>
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
                           const target = incomingOfflineOrTimeout.targetUser;
                           const mId = await createPendingMatchAndNotification(target);
                           setIncomingOfflineOrTimeout(null);
                           if (mId) {
                              useWordUpStore.getState().setMatchId(mId);
                              useWordUpStore.getState().setRole("player1");
                           }
                        }}
                        className="bg-correct hover:bg-correct/90 text-black text-[10px] font-black uppercase py-3 rounded-xl transition-all active:scale-95 cursor-pointer"
                     >
                        Play Mine Now
                     </button>
                     <button
                        onClick={async () => {
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
