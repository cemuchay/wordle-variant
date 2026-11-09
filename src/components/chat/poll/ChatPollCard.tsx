import { useState, useMemo } from "react";
import { BarChart3, Clock, EyeOff, Lock, Pin, RefreshCw, Shield } from "lucide-react";
import { usePoll } from "../../../hooks/usePoll";
import { PollOptionRow } from "./PollOptionRow";
import { useAppStore } from "../../../store/useAppStore";
import { TOAST_DURATION } from "../../../constants/ui";

interface ChatPollCardProps {
   pollId: string;
   currentUserId?: string;
   currentUserProfile?: { id: string; username: string; avatar_url: string };
   compact?: boolean;
}

export const ChatPollCard = ({
   pollId,
   currentUserId,
   currentUserProfile,
   compact = false,
}: ChatPollCardProps) => {
   const {
      poll,
      totalVotes,
      userVoteOptionId,
      isExpired,
      timeRemainingText,
      optionResults,
      loading,
      voting,
      castVote,
   } = usePoll(pollId, currentUserId, currentUserProfile);

   const [isChangingVote, setIsChangingVote] = useState(false);

   const maxCount = useMemo(() => {
      if (optionResults.length === 0) return 0;
      return Math.max(...optionResults.map((r) => r.count));
   }, [optionResults]);

   if (loading && !poll) {
      return (
         <div className="w-64 sm:w-72 p-3 rounded-2xl bg-slate-900/80 border border-white/10 animate-pulse space-y-2 my-1">
            <div className="h-3 bg-white/10 rounded w-2/3" />
            <div className="h-7 bg-white/5 rounded-xl w-full" />
            <div className="h-7 bg-white/5 rounded-xl w-full" />
         </div>
      );
   }

   if (!poll) {
      return (
         <div className="p-2.5 rounded-xl bg-slate-900/60 border border-white/10 text-[11px] text-gray-400 italic my-1">
            Poll unavailable or removed.
         </div>
      );
   }

   const hasVoted = Boolean(userVoteOptionId);
   // Live results are always viewable interactively; users can vote if not expired and (hasn't voted OR allow_change_vote is enabled)
   const canVote =
      Boolean(currentUserId) &&
      !isExpired &&
      (!hasVoted || (poll.allow_change_vote && (isChangingVote || true)));

   const handleSelectOption = async (optionId: string) => {
      if (!currentUserId) {
         useAppStore.getState().triggerToast("Sign in to vote on polls.", TOAST_DURATION.SHORT);
         return;
      }
      if (isExpired) {
         useAppStore.getState().triggerToast("This poll has already ended.", TOAST_DURATION.SHORT);
         return;
      }
      if (hasVoted && userVoteOptionId === optionId) {
         setIsChangingVote(false);
         return;
      }
      if (hasVoted && !poll.allow_change_vote) {
         useAppStore
            .getState()
            .triggerToast("Vote changing is locked for this poll.", TOAST_DURATION.SHORT);
         return;
      }

      try {
         await castVote(optionId);
         setIsChangingVote(false);
      } catch (err: unknown) {
         useAppStore
            .getState()
            .triggerToast(err instanceof Error ? err.message : "Failed to submit vote", TOAST_DURATION.SHORT);
      }
   };

   return (
      <div
         onClick={(e) => e.stopPropagation()}
         className={`${
            compact ? "w-full" : "w-64 sm:w-72 mt-1"
         } rounded-2xl bg-slate-900/95 border ${
            poll.is_admin_poll
               ? "border-amber-500/35 shadow-[0_4px_20px_rgba(245,158,11,0.08)]"
               : "border-indigo-500/30 shadow-lg"
         } p-3 text-left space-y-2.5 transition-all`}
      >
         {/* Header Badges */}
         <div className="flex items-center justify-between gap-1.5 flex-wrap">
            <div className="flex items-center gap-1.5">
               <span
                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                     poll.is_admin_poll
                        ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                        : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                  }`}
               >
                  {poll.is_admin_poll ? <Shield size={9} /> : <BarChart3 size={9} />}
                  {poll.is_admin_poll ? "Admin Poll" : "Poll"}
               </span>

               {poll.is_pinned && !isExpired && (
                  <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-correct/15 text-correct border border-correct/30 text-[8px] font-black uppercase">
                     <Pin size={8} />
                     Pinned
                  </span>
               )}

               {poll.is_anonymous && (
                  <span
                     className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/5 text-gray-400 border border-white/10 text-[8px] font-bold uppercase"
                     title="Anonymous Poll: Voter identities are hidden"
                  >
                     <EyeOff size={8} />
                     Anon
                  </span>
               )}
            </div>

            <span
               className={`inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                  isExpired
                     ? "bg-rose-500/15 text-rose-300 border border-rose-500/25"
                     : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/25"
               }`}
            >
               <Clock size={9} />
               {timeRemainingText}
            </span>
         </div>

         {/* Question */}
         <h4 className="text-xs font-extrabold text-white leading-snug break-words">
            {poll.question}
         </h4>

         {/* Options List with Live Results */}
         <div className="space-y-1.5">
            {optionResults.map((res) => (
               <PollOptionRow
                  key={res.option.id}
                  result={res}
                  isSelected={userVoteOptionId === res.option.id}
                  canVote={canVote}
                  showResults={true}
                  isLeading={maxCount > 0 && res.count === maxCount}
                  isAnonymous={poll.is_anonymous}
                  disabled={voting}
                  onSelect={handleSelectOption}
               />
            ))}
         </div>

         {/* Footer Metadata */}
         <div className="pt-1 border-t border-white/10 flex items-center justify-between gap-2 text-[9px] text-gray-400">
            <div className="flex items-center gap-1.5 font-bold">
               <span className="text-white/80 tabular-nums">
                  {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
               </span>
               <span>•</span>
               {poll.allow_change_vote ? (
                  <span className="inline-flex items-center gap-0.5 text-indigo-300/80">
                     <RefreshCw size={8} />
                     Can change vote
                  </span>
               ) : (
                  <span className="inline-flex items-center gap-0.5 text-amber-300/80">
                     <Lock size={8} />
                     Single final vote
                  </span>
               )}
            </div>

            {hasVoted && !isExpired && poll.allow_change_vote && (
               <span className="text-[8px] font-black uppercase text-correct tracking-wider">
                  Tap another to switch
               </span>
            )}
         </div>
      </div>
   );
};
