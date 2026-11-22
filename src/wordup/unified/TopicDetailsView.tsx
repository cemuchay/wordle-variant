import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, UserPlus, Search, ChevronLeft, ChevronRight, Play, Users, Flame, PauseCircle, Trash2, Eye, X } from "lucide-react";
import { fetchTopicPreviewMedia, type TopicPreviewMedia } from "../shared/topicPreviewMedia";
import { CATEGORIES } from "../shared/constants";
import { CATEGORY_STYLE_MAP, DEFAULT_STYLE } from "../shared/categorySelectConstants";
import { type ProfileStats } from "../shared/types";
import { type PausedMatch } from "../shared/pauseStorage";
import { RankingView } from "../shared/RankingView";
import { ProtectedAvatar } from "../../components/chat/ProtectedAvatar";
import { supabase } from "../../lib/supabaseClient";
import { Z_INDEX } from "../../constants/ui";
import { useApp } from "../../context/AppContext";
import { useAsyncMatchmaking } from "../async/hooks/useMatchmaking";
import { PlayNowLaterPopup } from "../async/components/PlayNowLaterPopup";
import { TOAST_DURATION } from "../../constants/ui";

interface TopicDetailsViewProps {
   categoryId: string;
   onBack: () => void;
   currentUser: any;
   userStats: ProfileStats | null;
   getRankColor: (rankName: string) => string;
   allProfiles: any[];
   onPlayLive: () => void;
   onChallengePlayer: (targetUser: any) => void;
   onPlayBot?: () => void;
   onPlayMarathon?: () => void;
   pausedMatches?: PausedMatch[];
   onResumePausedMatch?: (paused: PausedMatch) => void;
   onDiscardPausedMatch?: (matchId: string) => void;
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
   onPlayMarathon,
   pausedMatches = [],
   onResumePausedMatch,
   onDiscardPausedMatch,
}: TopicDetailsViewProps) => {
   const [activeSection] = useState<"play" | "rankings">("play");
   const [playerSearch, setPlayerSearch] = useState("");
   const [showInviteOverlay, setShowInviteOverlay] = useState(false);
   const [categoryStats, setCategoryStats] = useState<ProfileStats | null>(null);
   const inviteSectionRef = useRef<HTMLDivElement | null>(null);

   const { triggerToast } = useApp();
   const { createMatch } = useAsyncMatchmaking(currentUser, categoryId, triggerToast);
   const [isCreatingMatch, setIsCreatingMatch] = useState<string | null>(null);
   const [pendingChallengeMatch, setPendingChallengeMatch] = useState<any | null>(null);
   const [creationTimeout, setCreationTimeout] = useState(false);

   const handleChallenge = async (profile: any) => {
      if (isCreatingMatch) return;
      setIsCreatingMatch(profile.id);
      setCreationTimeout(false);

      const timer = setTimeout(() => {
         setCreationTimeout(true);
      }, 10000);

      try {
         const mId = await createMatch(profile);
         clearTimeout(timer);
         if (mId) {
            const { data: match } = await supabase
               .from("wordup_async_matches")
               .select("*, player1:player1_id(username, avatar_url), player2:player2_id(username, avatar_url)")
               .eq("id", mId)
               .single();
            if (match) {
               setPendingChallengeMatch({ match, profile });
            }
         }
      } catch (err) {
         console.error("Failed to challenge player:", err);
         clearTimeout(timer);
      } finally {
         setIsCreatingMatch(null);
      }
   };

   // Topic preview media (video + screenshots from Supabase Storage)
   const [previewMedia, setPreviewMedia] = useState<TopicPreviewMedia | null>(null);
   const [lightboxOpen, setLightboxOpen] = useState(false);
   const [lightboxIndex, setLightboxIndex] = useState(0);
   const [showLightboxControls, setShowLightboxControls] = useState(true);
   const lightboxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

   const bumpLightboxControls = () => {
      setShowLightboxControls(true);
      if (lightboxTimerRef.current) clearTimeout(lightboxTimerRef.current);
      lightboxTimerRef.current = setTimeout(() => {
         setShowLightboxControls(false);
      }, 2000);
   };

   useEffect(() => {
      if (!lightboxOpen) {
         if (lightboxTimerRef.current) clearTimeout(lightboxTimerRef.current);
         return;
      }
      bumpLightboxControls();
      return () => {
         if (lightboxTimerRef.current) clearTimeout(lightboxTimerRef.current);
      };
   }, [lightboxOpen, lightboxIndex]);

   useEffect(() => {
      let cancelled = false;
      setPreviewMedia(null);
      setLightboxOpen(false);
      setLightboxIndex(0);
      if (!categoryId) return;
      fetchTopicPreviewMedia(categoryId).then((media) => {
         if (!cancelled) setPreviewMedia(media);
      });
      return () => {
         cancelled = true;
      };
   }, [categoryId]);

   useEffect(() => {
      if (showInviteOverlay) {
         setTimeout(() => {
            inviteSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
         }, 150);
      }
   }, [showInviteOverlay]);

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

   const topicPausedMatches = (pausedMatches || []).filter((pm) => pm.categoryId === categoryId);

   // Filter out current user and match username query
   const filteredPlayers = (allProfiles || []).filter((p: any) =>
      p.id !== currentUser?.id &&
      (p.username || "").toLowerCase().includes(playerSearch.toLowerCase())
   );

   return (
      <div className="flex flex-col flex-1 bg-[#121212] text-white min-h-0 relative select-none w-full max-w-4xl mx-auto">
         {/* Navigation Bar / Top Header */}
         <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#181818] shrink-0">
            <div className="flex items-center gap-3">
               <button
                  onClick={onBack}
                  className="p-2 bg-black/40 hover:bg-black/60 rounded-full border border-white/10 transition-all cursor-pointer"
               >
                  <ChevronLeft size={20} className="text-[#E85151]" />
               </button>
               <h1 className="text-base font-black uppercase tracking-wider text-white">
                  {categoryObj.name}
               </h1>
            </div>

            {/* Top Action: Play Live Match */}
            <button
               type="button"
               onClick={onPlayLive}
               className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#E85151] hover:bg-[#d64545] text-white text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-98 cursor-pointer"
            >
               <Swords size={14} />
               <span>Play Live Match</span>
            </button>
         </div>

         {/* Content Area */}
         <div className="flex-1 overflow-y-auto p-4 sm:p-6 scrollbar-hide">
            <AnimatePresence mode="wait">
               {activeSection === "play" ? (
                  <motion.div
                     key="play-section"
                     initial={{ opacity: 0, y: 10 }}
                     animate={{ opacity: 1, y: 0 }}
                     exit={{ opacity: 0, y: -10 }}
                     className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start"
                  >
                     {/* LEFT COLUMN: Cover Header & User Stats */}
                     <div className="space-y-5">
                        <div
                           onClick={() => {
                              if (previewMedia?.videoUrl || (previewMedia && previewMedia.screenshots.length > 0)) {
                                 setLightboxIndex(0);
                                 setLightboxOpen(true);
                              }
                           }}
                           className={`relative overflow-hidden min-h-[240px] pt-10 pb-8 px-6 bg-linear-to-b from-[#E85151]/20 via-[#181818]/60 to-[#121212] border border-white/10 rounded-3xl flex flex-col items-center justify-end text-center shadow-lg ${
                              previewMedia?.videoUrl || (previewMedia && previewMedia.screenshots.length > 0) ? "cursor-pointer" : ""
                           }`}
                        >
                           {/* Background Gameplay Preview Media */}
                           {previewMedia?.videoUrl ? (
                              <>
                                 <video
                                    src={previewMedia.videoUrl}
                                    autoPlay
                                    loop
                                    muted
                                    playsInline
                                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                                 />
                                 <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/30 to-[#121212]/75 pointer-events-none" />
                              </>
                           ) : previewMedia && previewMedia.screenshots.length > 0 ? (
                              <>
                                 <img
                                    src={previewMedia.screenshots[0].url}
                                    alt={categoryObj.name}
                                    className="absolute inset-0 w-full h-full object-cover pointer-events-none"
                                 />
                                 <div className="absolute inset-0 bg-gradient-to-b from-black/15 via-black/30 to-[#121212]/75 pointer-events-none" />
                              </>
                           ) : null}

                           {(previewMedia?.videoUrl || (previewMedia && previewMedia.screenshots.length > 0)) && (
                              <button
                                 type="button"
                                 onClick={() => {
                                    setLightboxIndex(0);
                                    setLightboxOpen(true);
                                 }}
                                 className="absolute top-3 right-3 z-20 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/80 border border-white/20 text-[10px] font-black uppercase tracking-wider text-white/90 backdrop-blur-sm transition-colors cursor-pointer"
                              >
                                 <Eye className="w-3 h-3" />
                                 Preview
                              </button>
                           )}

                           {/* Category Emoji/SVG Circle */}
                           <div className="relative z-10 w-20 h-20 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)] mb-4 overflow-hidden p-4 backdrop-blur-sm pointer-events-none">
                              {style.svg ? (
                                 <div className="w-full h-full text-white flex items-center justify-center [&>svg]:w-full [&>svg]:h-full" dangerouslySetInnerHTML={{ __html: style.svg }} />
                              ) : (
                                 <span className="text-4xl">{style.emoji}</span>
                              )}
                           </div>

                           {/* Category Title & Description */}
                           <h2 className="relative z-10 text-2xl font-black uppercase tracking-wider text-white mb-2 pointer-events-none">
                              {categoryObj.name}
                           </h2>
                           <p className="relative z-10 text-xs text-white/80 font-bold max-w-sm leading-relaxed pointer-events-none">
                              {categoryObj.desc}
                           </p>
                        </div>

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
                     </div>

                     {/* RIGHT COLUMN: Action Buttons & Collapsible Challenge Panel */}
                     <div className="space-y-4">
                        {/* Topic Paused Match Card */}
                        {topicPausedMatches.map((pm) => {
                           const isP1 = pm.role === "player1";
                           const myScore = isP1 ? (pm.matchData?.p1_score || 0) : (pm.matchData?.p2_score || 0);
                           const oppScore = isP1 ? (pm.matchData?.p2_score || 0) : (pm.matchData?.p1_score || 0);
                           const totalQ = pm.questions?.length || 7;

                           return (
                              <div key={pm.matchId} className="bg-amber-500/10 border-2 border-amber-500/40 rounded-2xl p-4 space-y-2 shadow-lg">
                                 <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2 text-amber-400">
                                       <PauseCircle size={20} />
                                       <span className="text-xs font-black uppercase tracking-wider">Paused Game in Progress</span>
                                    </div>
                                    <button
                                       onClick={() => onDiscardPausedMatch?.(pm.matchId)}
                                       className="p-1 bg-white/5 hover:bg-white/10 text-white/40 hover:text-red-400 rounded-lg transition-colors cursor-pointer"
                                       title="Discard Match"
                                    >
                                       <Trash2 size={14} />
                                    </button>
                                 </div>
                                 <p className="text-[11px] text-amber-200 font-bold uppercase">
                                    Paused at Round {pm.currentIdx + 1}/{totalQ} • Score: {myScore} - {oppScore} pts
                                 </p>
                                 <button
                                    onClick={() => onResumePausedMatch?.(pm)}
                                    className="w-full bg-amber-500 hover:bg-amber-600 text-black font-black uppercase py-3.5 rounded-xl flex items-center justify-center gap-2 tracking-widest shadow-md transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
                                 >
                                    <Play size={16} fill="black" />
                                    <span>Resume Paused Game</span>
                                 </button>
                              </div>
                           );
                        })}

                        <div className="space-y-3">
                           <button
                              onClick={onPlayLive}
                              className="w-full bg-[#E85151] hover:bg-[#d44343] text-white font-black uppercase py-4 rounded-2xl flex items-center justify-center gap-2.5 tracking-widest shadow-[0_4px_25px_rgba(232,81,81,0.25)] hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                           >
                              <Swords size={18} className="stroke-3" />
                              <span>Play Live Match</span>
                           </button>

                           {onPlayMarathon && (
                              <button
                                 onClick={onPlayMarathon}
                                 className="w-full bg-linear-to-r from-amber-500 to-red-600 hover:from-amber-600 hover:to-red-700 text-white font-black uppercase py-4 rounded-2xl flex items-center justify-center gap-2.5 tracking-widest shadow-[0_4px_20px_rgba(245,158,11,0.3)] hover:scale-[1.01] active:scale-[0.99] transition-all cursor-pointer"
                              >
                                 <Flame size={18} className="fill-white" />
                                 <span>Play Marathon</span>
                              </button>
                           )}

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
                                 ref={inviteSectionRef}
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
                                                onClick={() => handleChallenge(profile)}
                                                disabled={isCreatingMatch !== null}
                                                className="flex items-center gap-1 bg-[#E85151]/10 hover:bg-[#E85151]/20 border border-[#E85151]/25 text-[#E85151] text-[9px] font-black uppercase tracking-wider px-3 py-1.5 rounded-xl transition-all cursor-pointer disabled:opacity-50"
                                             >
                                                {isCreatingMatch === profile.id ? "..." : "Challenge"}
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
                     </div>
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

         {pendingChallengeMatch && (
            <PlayNowLaterPopup
               opponentName={pendingChallengeMatch.profile.username || "Opponent"}
               category={categoryId}
               onPlayNow={() => {
                  const pcm = pendingChallengeMatch;
                  setPendingChallengeMatch(null);
                  onChallengePlayer(pcm.match);
               }}
               onLater={() => {
                  setPendingChallengeMatch(null);
                  setShowInviteOverlay(false);
                  triggerToast("Challenge saved! Play when you're ready.", TOAST_DURATION.DEFAULT);
               }}
            />
         )}

         {isCreatingMatch && (
            <div className="fixed inset-0 flex flex-col items-center justify-center bg-black/85 backdrop-blur-xs p-6 text-center space-y-5 animate-in fade-in duration-200" style={{ zIndex: Z_INDEX.TOPIC_DETAILS }}>
               <div className="w-12 h-12 border-4 border-[#E85151]/30 border-t-[#E85151] rounded-full animate-spin" />
               <div className="space-y-1">
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">Creating 1v1 Game</h3>
                  <p className="text-[10px] text-white/60 font-bold uppercase tracking-wider">Generating questions and preparing match...</p>
               </div>
               {creationTimeout && (
                  <button
                     onClick={() => {
                        setIsCreatingMatch(null);
                        setCreationTimeout(false);
                        triggerToast("Matchmaking creation cancelled.", TOAST_DURATION.DEFAULT);
                     }}
                     className="mt-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider text-white transition-all cursor-pointer hover:scale-102 active:scale-98"
                  >
                     Cancel & Return
                  </button>
               )}
            </div>
         )}
         {lightboxOpen && previewMedia && (
            <div
               className="fixed inset-0 flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
               style={{ zIndex: Z_INDEX.TOPIC_DETAILS }}
               onClick={() => setLightboxOpen(false)}
            >
               <div
                  className="relative w-full max-w-2xl bg-[#121212] border border-white/15 rounded-2xl overflow-hidden shadow-2xl"
                  onClick={(e) => {
                     e.stopPropagation();
                     bumpLightboxControls();
                  }}
                  onMouseMove={bumpLightboxControls}
                  onTouchStart={bumpLightboxControls}
               >
                  <div className={`flex items-center justify-between px-4 py-3 border-b border-white/10 transition-opacity duration-300 ${showLightboxControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                     <span className="text-xs font-black uppercase tracking-wider text-white">
                        {categoryObj.name} Preview
                     </span>
                     <button
                        type="button"
                        onClick={() => setLightboxOpen(false)}
                        className="p-1.5 rounded-lg bg-white/5 hover:bg-white/15 text-white/70 hover:text-white transition-colors cursor-pointer"
                     >
                        <X className="w-4 h-4" />
                     </button>
                  </div>

                  {(() => {
                     const items: { type: "video" | "image"; url: string }[] = [
                        ...(previewMedia.videoUrl ? [{ type: "video" as const, url: previewMedia.videoUrl }] : []),
                        ...previewMedia.screenshots.map((s) => ({ type: "image" as const, url: s.url })),
                     ];
                     const current = items[lightboxIndex] ?? items[0];
                     if (!current) return null;

                     return (
                        <div className="relative bg-black flex items-center justify-center min-h-[260px] max-h-[70vh]">
                           {current.type === "video" ? (
                              <video
                                 src={current.url}
                                 autoPlay
                                 loop
                                 muted
                                 playsInline
                                 className="w-full max-h-[70vh] object-contain"
                              />
                           ) : (
                              <img
                                 src={current.url}
                                 alt={`${categoryObj.name} screenshot`}
                                 className="w-full max-h-[70vh] object-contain"
                              />
                           )}

                           {items.length > 1 && (
                              <div className={`transition-opacity duration-300 ${showLightboxControls ? "opacity-100" : "opacity-0 pointer-events-none"}`}>
                                 <button
                                    type="button"
                                    onClick={() => setLightboxIndex((i) => (i - 1 + items.length) % items.length)}
                                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/70 hover:bg-black text-white border border-white/15 cursor-pointer"
                                 >
                                    <ChevronLeft className="w-4 h-4" />
                                 </button>
                                 <button
                                    type="button"
                                    onClick={() => setLightboxIndex((i) => (i + 1) % items.length)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/70 hover:bg-black text-white border border-white/15 cursor-pointer"
                                 >
                                    <ChevronRight className="w-4 h-4" />
                                 </button>
                                 <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-2.5 py-1 rounded-full bg-black/70 text-[10px] font-bold text-white/80">
                                    {lightboxIndex + 1} / {items.length}
                                 </div>
                              </div>
                           )}
                        </div>
                     );
                  })()}
               </div>
            </div>
         )}
      </div>
   );
};
