import {
   ArrowLeft,
   Clock,
   EyeOff,
   Lock,
   Pin,
   RefreshCw,
   StopCircle,
   Trophy,
   Users,
} from "lucide-react";
import { ProtectedAvatar } from "../../chat/ProtectedAvatar";
import { formatPollRemainingTime } from "../../../hooks/usePoll";
import type { PollWithResults } from "../../../types/poll";

interface AdminPollDetailViewProps {
   item: PollWithResults;
   actionLoading: boolean;
   onBack: () => void;
   onTogglePin: () => void;
   onEndEarly: () => void;
}

export const AdminPollDetailView = ({
   item,
   actionLoading,
   onBack,
   onTogglePin,
   onEndEarly,
}: AdminPollDetailViewProps) => {
   const { poll, totalVotes, isExpired, optionResults } = item;
   const maxCount = Math.max(0, ...optionResults.map((r) => r.count));
   const remaining = formatPollRemainingTime(poll.expires_at);

   return (
      <div className="space-y-4">
         {/* Top Bar */}
         <div className="flex items-center justify-between gap-2">
            <button
               type="button"
               onClick={onBack}
               className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer"
            >
               <ArrowLeft size={14} />
               <span>Back to Polls List</span>
            </button>

            <span
               className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                  isExpired
                     ? "bg-rose-500/20 text-rose-300 border border-rose-500/30"
                     : "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
               }`}
            >
               {isExpired ? "Ended" : remaining.text}
            </span>
         </div>

         {/* Poll Metadata Summary Card */}
         <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 space-y-2.5">
            <div className="flex items-center justify-between gap-2 flex-wrap">
               <div className="flex items-center gap-1.5">
                  {poll.is_pinned && !isExpired && (
                     <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[9px] font-black uppercase">
                        <Pin size={9} /> Pinned
                     </span>
                  )}
                  {poll.is_anonymous ? (
                     <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[9px] font-black uppercase">
                        <EyeOff size={9} /> Anonymous Poll
                     </span>
                  ) : (
                     <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-[9px] font-black uppercase">
                        <Users size={9} /> Public Votes
                     </span>
                  )}
                  {poll.allow_change_vote ? (
                     <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[9px] font-black uppercase">
                        <RefreshCw size={9} /> Vote Change Allowed
                     </span>
                  ) : (
                     <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/10 text-gray-300 border border-white/10 text-[9px] font-black uppercase">
                        <Lock size={9} /> Vote Locked
                     </span>
                  )}
               </div>

               <span className="text-[11px] font-black text-white">
                  Total Votes: {totalVotes}
               </span>
            </div>

            <h3 className="text-sm font-black text-white leading-snug">{poll.question}</h3>

            <div className="text-[10px] text-gray-400 flex items-center gap-3 flex-wrap">
               <span>
                  Created: {new Date(poll.created_at).toLocaleString()}
               </span>
               <span>•</span>
               <span className="inline-flex items-center gap-1">
                  <Clock size={10} />
                  Expires: {new Date(poll.expires_at).toLocaleString()}
               </span>
            </div>

            {/* Admin Controls for Active Polls */}
            {!isExpired && (
               <div className="pt-2 border-t border-white/10 flex items-center gap-2">
                  <button
                     type="button"
                     disabled={actionLoading}
                     onClick={onTogglePin}
                     className={`flex-1 py-2 px-3 rounded-xl text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                        poll.is_pinned
                           ? "bg-amber-500/20 text-amber-300 border-amber-500/40 hover:bg-amber-500/30"
                           : "bg-white/5 text-gray-200 border-white/10 hover:bg-white/10"
                     }`}
                  >
                     <Pin size={12} />
                     <span>{poll.is_pinned ? "Unpin from Chat" : "Pin to Top (Max 1)"}</span>
                  </button>

                  <button
                     type="button"
                     disabled={actionLoading}
                     onClick={onEndEarly}
                     className="flex-1 py-2 px-3 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 text-[11px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                     <StopCircle size={12} />
                     <span>End Poll Now</span>
                  </button>
               </div>
            )}
         </div>

         {/* Detailed Option Breakdown */}
         <div className="space-y-2.5">
            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
               Detailed Option Results
            </h4>

            {optionResults.map((res) => {
               const isWinner = maxCount > 0 && res.count === maxCount;
               return (
                  <div
                     key={res.option.id}
                     className={`p-3 rounded-xl border space-y-2 ${
                        isWinner
                           ? "bg-correct/10 border-correct/40"
                           : "bg-slate-950/60 border-white/10"
                     }`}
                  >
                     <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 min-w-0">
                           {isWinner && <Trophy size={13} className="text-correct shrink-0" />}
                           <span className="text-xs font-extrabold text-white break-words">
                              {res.option.text}
                           </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                           <span className="text-xs font-black text-white tabular-nums">
                              {res.percentage}%
                           </span>
                           <span className="text-[10px] font-bold text-gray-400 tabular-nums">
                              ({res.count} {res.count === 1 ? "vote" : "votes"})
                           </span>
                        </div>
                     </div>

                     {/* Progress Bar */}
                     <div className="w-full h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                           style={{ width: `${res.percentage}%` }}
                           className={`h-full rounded-full transition-all duration-300 ${
                              isWinner ? "bg-correct" : "bg-indigo-500"
                           }`}
                        />
                     </div>

                     {/* Voters list if public */}
                     {!poll.is_anonymous ? (
                        res.voters.length > 0 ? (
                           <div className="pt-1 flex flex-wrap gap-1.5">
                              {res.voters.map((v) => (
                                 <span
                                    key={v.id}
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-[10px] font-bold text-gray-200"
                                 >
                                    <ProtectedAvatar
                                       userId={v.id}
                                       src={v.avatar_url}
                                       username={v.username}
                                       className="w-3.5 h-3.5 rounded-full"
                                    />
                                    {v.username}
                                 </span>
                              ))}
                           </div>
                        ) : (
                           <p className="text-[10px] text-gray-500 italic">No votes for this option</p>
                        )
                     ) : (
                        <p className="text-[10px] text-purple-300/70 italic flex items-center gap-1">
                           <EyeOff size={10} /> Voter identities hidden (Anonymous Poll)
                        </p>
                     )}
                  </div>
               );
            })}
         </div>
      </div>
   );
};

