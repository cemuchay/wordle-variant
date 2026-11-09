import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Pin, ChevronDown, ChevronUp, Clock, Shield, X } from "lucide-react";
import { usePoll } from "../../../hooks/usePoll";
import { ChatPollCard } from "./ChatPollCard";
import { setAdminPollPinned } from "../../../services/pollService";
import type { Poll } from "../../../types/poll";

interface PinnedPollBannerProps {
   pinnedPoll: Poll;
   currentUserId?: string;
   currentUserProfile?: { id: string; username: string; avatar_url: string };
   isAdmin?: boolean;
   onJumpToPollMessage?: (pollId: string) => void;
   onUnpinned?: () => void;
}

export const PinnedPollBanner = ({
   pinnedPoll,
   currentUserId,
   currentUserProfile,
   isAdmin,
   onJumpToPollMessage,
   onUnpinned,
}: PinnedPollBannerProps) => {
   const [expanded, setExpanded] = useState(false);
   const { totalVotes, userVoteOptionId, timeRemainingText, isExpired } = usePoll(
      pinnedPoll.id,
      currentUserId,
      currentUserProfile
   );

   // Automatically hide when lifetime expires
   if (isExpired) {
      return null;
   }

   const handleUnpin = async (e: React.MouseEvent) => {
      e.stopPropagation();
      await setAdminPollPinned(pinnedPoll.id, pinnedPoll.group_id, false);
      onUnpinned?.();
   };

   return (
      <div className="bg-gradient-to-r from-amber-500/15 via-indigo-500/15 to-slate-900/90 border-b border-amber-500/30 shrink-0 z-20">
         {/* Collapsed Top Strip */}
         <div
            onClick={() => setExpanded((prev) => !prev)}
            className="px-3.5 py-2 flex items-center justify-between gap-2 cursor-pointer hover:bg-white/5 transition-colors"
         >
            <div className="flex items-center gap-2 min-w-0 flex-1">
               <div className="w-6 h-6 rounded-lg bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shrink-0">
                  <Pin size={12} className="rotate-45" />
               </div>
               <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                     <span className="text-[9px] font-black uppercase tracking-wider text-amber-300 inline-flex items-center gap-1">
                        <Shield size={9} />
                        Pinned Admin Poll
                     </span>
                     <span className="text-[9px] font-bold text-emerald-300 inline-flex items-center gap-0.5">
                        • <Clock size={8} /> {timeRemainingText}
                     </span>
                  </div>
                  <p className="text-xs font-extrabold text-white truncate">
                     {pinnedPoll.question}
                  </p>
               </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
               <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                     userVoteOptionId
                        ? "bg-correct/20 text-correct border border-correct/30"
                        : "bg-amber-500 text-black"
                  }`}
               >
                  {userVoteOptionId ? `Voted (${totalVotes})` : `Vote (${totalVotes})`}
               </span>

               {onJumpToPollMessage && (
                  <button
                     type="button"
                     onClick={(e) => {
                        e.stopPropagation();
                        onJumpToPollMessage(pinnedPoll.id);
                     }}
                     className="px-1.5 py-0.5 rounded text-[9px] font-bold text-indigo-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                     title="Jump to poll in chat"
                  >
                      Chat
                  </button>
               )}

               {isAdmin && (
                  <button
                     type="button"
                     onClick={handleUnpin}
                     className="p-1 text-gray-400 hover:text-rose-400 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                     title="Unpin poll"
                  >
                     <X size={12} />
                  </button>
               )}

               <button
                  type="button"
                  onClick={(e) => {
                     e.stopPropagation();
                     setExpanded((prev) => !prev);
                  }}
                  className="p-1 text-gray-300 hover:text-white rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
                  title={expanded ? "Collapse poll" : "Expand poll"}
               >
                  {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
               </button>
            </div>
         </div>

         {/* Expanded Interactive Poll Card */}
         <AnimatePresence>
            {expanded && (
               <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden px-3 pb-3 pt-1"
               >
                  <ChatPollCard
                     pollId={pinnedPoll.id}
                     currentUserId={currentUserId}
                     currentUserProfile={currentUserProfile}
                     compact={true}
                  />
               </motion.div>
            )}
         </AnimatePresence>
      </div>
   );
};

