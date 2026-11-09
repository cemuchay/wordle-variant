import { useState } from "react";
import {
   ArrowLeft,
   BarChart3,
   CheckCircle2,
   Clock,
   Eye,
   EyeOff,
   Lock,
   Pin,
   RefreshCw,
   Send,
   Shield,
} from "lucide-react";
import { formatDurationLabel } from "../../../../types/poll";

interface PollOverviewStepProps {
   question: string;
   options: string[];
   durationHours: number;
   allowChangeVote: boolean;
   isAnonymous: boolean;
   isPinned: boolean;
   isAdmin: boolean;
   isSubmitting: boolean;
   onBack: () => void;
   onConfirmSubmit: () => void;
}

export const PollOverviewStep = ({
   question,
   options,
   durationHours,
   allowChangeVote,
   isAnonymous,
   isPinned,
   isAdmin,
   isSubmitting,
   onBack,
   onConfirmSubmit,
}: PollOverviewStepProps) => {
   const [previewTimeMs] = useState<number>(() => Date.now());
   const cleanOptions = options.map((o) => o.trim()).filter((o) => o.length > 0);
   const expiresAtDate = new Date(previewTimeMs + durationHours * 60 * 60 * 1000);

   return (
      <div className="space-y-4">
         {/* Banner header */}
         <div className="p-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center gap-2 text-xs text-indigo-200">
            <CheckCircle2 size={15} className="text-indigo-400 shrink-0" />
            <span className="font-semibold">
               Please review your poll details and message preview before publishing to General chat.
            </span>
         </div>

         {/* Live Visual Message Card Preview */}
         <div className="space-y-1.5">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
               In-Chat Message Preview
            </span>

            <div
               className={`rounded-2xl bg-slate-950/90 border ${
                  isAdmin
                     ? "border-amber-500/40 shadow-[0_4px_20px_rgba(245,158,11,0.08)]"
                     : "border-indigo-500/30"
               } p-3.5 space-y-2.5`}
            >
               <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                     <span
                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider ${
                           isAdmin
                              ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                              : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                        }`}
                     >
                        {isAdmin ? <Shield size={9} /> : <BarChart3 size={9} />}
                        {isAdmin ? "Admin Poll" : "Poll"}
                     </span>

                     {isAdmin && isPinned && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-correct/15 text-correct border border-correct/30 text-[8px] font-black uppercase">
                           <Pin size={8} />
                           Pinned to Top
                        </span>
                     )}

                     {isAnonymous && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-white/5 text-gray-400 border border-white/10 text-[8px] font-bold uppercase">
                           <EyeOff size={8} />
                           Anon
                        </span>
                     )}
                  </div>

                  <span className="inline-flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                     <Clock size={9} />
                     {formatDurationLabel(durationHours)}
                  </span>
               </div>

               <h4 className="text-xs font-extrabold text-white leading-snug break-words">
                  {question.trim()}
               </h4>

               <div className="space-y-1.5">
                  {cleanOptions.map((optText, i) => (
                     <div
                        key={i}
                        className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 flex items-center justify-between gap-2"
                     >
                        <div className="flex items-center gap-2 min-w-0">
                           <div className="w-3.5 h-3.5 rounded-full border border-white/30 shrink-0" />
                           <span className="text-xs font-semibold text-gray-200 truncate">
                              {optText}
                           </span>
                        </div>
                        <span className="text-[10px] font-black text-white/40">0% (0)</span>
                     </div>
                  ))}
               </div>
            </div>
         </div>

         {/* Configuration Summary Checklist */}
         <div className="rounded-xl bg-white/5 border border-white/10 p-3 space-y-2 text-xs">
            <span className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
               Configuration Summary
            </span>

            <div className="grid grid-cols-2 gap-2 text-[11px]">
               <div className="flex items-center gap-1.5 text-gray-300">
                  <Clock size={12} className="text-indigo-400 shrink-0" />
                  <span>
                     Duration: <strong className="text-white">{formatDurationLabel(durationHours)}</strong>
                  </span>
               </div>

               <div className="flex items-center gap-1.5 text-gray-300">
                  {allowChangeVote ? (
                     <>
                        <RefreshCw size={12} className="text-emerald-400 shrink-0" />
                        <span>
                           Vote Change: <strong className="text-emerald-300">Allowed</strong>
                        </span>
                     </>
                  ) : (
                     <>
                        <Lock size={12} className="text-amber-400 shrink-0" />
                        <span>
                           Vote Change: <strong className="text-amber-300">Locked</strong>
                        </span>
                     </>
                  )}
               </div>

               <div className="flex items-center gap-1.5 text-gray-300">
                  {isAnonymous ? (
                     <>
                        <EyeOff size={12} className="text-purple-400 shrink-0" />
                        <span>
                           Privacy: <strong className="text-purple-300">Anonymous</strong>
                        </span>
                     </>
                  ) : (
                     <>
                        <Eye size={12} className="text-cyan-400 shrink-0" />
                        <span>
                           Privacy: <strong className="text-cyan-300">Public Votes</strong>
                        </span>
                     </>
                  )}
               </div>

               {isAdmin && (
                  <div className="flex items-center gap-1.5 text-gray-300">
                     <Pin size={12} className="text-amber-400 shrink-0" />
                     <span>
                        Pin on Top:{" "}
                        <strong className={isPinned ? "text-amber-300" : "text-gray-400"}>
                           {isPinned ? "Yes (Lifetime)" : "No"}
                        </strong>
                     </span>
                  </div>
               )}
            </div>

            <div className="pt-1 border-t border-white/5 text-[10px] text-gray-400">
               Expires on{" "}
               <span className="text-white font-semibold">
                  {expiresAtDate.toLocaleDateString(undefined, {
                     month: "short",
                     day: "numeric",
                     hour: "2-digit",
                     minute: "2-digit",
                  })}
               </span>{" "}
               • 1 vote per user
            </div>
         </div>

         {/* Action Buttons */}
         <div className="flex items-center gap-2 pt-1">
            <button
               type="button"
               disabled={isSubmitting}
               onClick={onBack}
               className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
            >
               <ArrowLeft size={14} />
               <span>Back to Edit</span>
            </button>

            <button
               type="button"
               disabled={isSubmitting}
               onClick={onConfirmSubmit}
               className="flex-1 py-2.5 px-4 rounded-xl bg-correct hover:bg-correct/90 disabled:opacity-50 text-black text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-lg"
            >
               <Send size={13} />
               <span>{isSubmitting ? "Publishing..." : "Publish Poll"}</span>
            </button>
         </div>
      </div>
   );
};
