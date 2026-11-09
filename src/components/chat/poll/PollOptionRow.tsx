import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Users } from "lucide-react";
import { ProtectedAvatar } from "../ProtectedAvatar";
import type { PollOptionResult } from "../../../types/poll";

interface PollOptionRowProps {
   result: PollOptionResult;
   isSelected: boolean;
   canVote: boolean;
   showResults: boolean;
   isLeading: boolean;
   isAnonymous: boolean;
   disabled: boolean;
   onSelect: (optionId: string) => void;
}

export const PollOptionRow = ({
   result,
   isSelected,
   canVote,
   showResults,
   isLeading,
   isAnonymous,
   disabled,
   onSelect,
}: PollOptionRowProps) => {
   const [showVoters, setShowVoters] = useState(false);
   const { option, count, percentage, voters } = result;

   return (
      <div className="space-y-1">
         <button
            type="button"
            disabled={disabled || !canVote}
            onClick={(e) => {
               e.stopPropagation();
               if (canVote && !disabled) {
                  onSelect(option.id);
               }
            }}
            className={`relative w-full text-left overflow-hidden rounded-xl border transition-all duration-200 px-3 py-2 ${
               isSelected
                  ? "border-correct/60 bg-correct/10 shadow-[0_0_12px_rgba(34,197,94,0.12)]"
                  : isLeading && showResults
                  ? "border-indigo-400/40 bg-indigo-500/10"
                  : "border-white/10 bg-slate-950/50 hover:bg-white/5"
            } ${canVote && !disabled ? "cursor-pointer active:scale-[0.99]" : "cursor-default"}`}
         >
            {/* Animated progress bar background */}
            {showResults && (
               <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${percentage}%` }}
                  transition={{ duration: 0.4, ease: "easeOut" }}
                  className={`absolute inset-y-0 left-0 pointer-events-none ${
                     isSelected
                        ? "bg-correct/25"
                        : isLeading
                        ? "bg-indigo-500/25"
                        : "bg-white/10"
                  }`}
               />
            )}

            <div className="relative z-10 flex items-center justify-between gap-2">
               <div className="flex items-center gap-2 min-w-0 flex-1">
                  {/* Radio / Check indicator */}
                  <div
                     className={`w-4 h-4 rounded-full flex items-center justify-center shrink-0 border transition-colors ${
                        isSelected
                           ? "bg-correct border-correct text-black"
                           : "border-white/30 bg-black/20"
                     }`}
                  >
                     {isSelected && <Check size={10} strokeWidth={3.5} />}
                  </div>

                  <span
                     className={`text-xs leading-snug break-words ${
                        isSelected
                           ? "font-black text-white"
                           : "font-semibold text-gray-200"
                     }`}
                  >
                     {option.text}
                  </span>
               </div>

               {showResults && (
                  <div className="flex items-center gap-1.5 shrink-0">
                     {/* Mini voter avatars if public poll */}
                     {!isAnonymous && voters.length > 0 && (
                        <div
                           onClick={(e) => {
                              e.stopPropagation();
                              setShowVoters((prev) => !prev);
                           }}
                           className="flex -space-x-1.5 items-center cursor-pointer hover:opacity-90 pl-1"
                           title="Tap to see who voted"
                        >
                           {voters.slice(0, 3).map((v) => (
                              <ProtectedAvatar
                                 key={v.id}
                                 userId={v.id}
                                 src={v.avatar_url}
                                 username={v.username}
                                 className="w-4 h-4 rounded-full border border-slate-900 bg-slate-800"
                              />
                           ))}
                           {voters.length > 3 && (
                              <span className="w-4 h-4 rounded-full bg-slate-800 border border-slate-700 text-[8px] font-black text-gray-300 flex items-center justify-center">
                                 +{voters.length - 3}
                              </span>
                           )}
                        </div>
                     )}

                     <span className="text-[10px] font-black tabular-nums text-white/90">
                        {percentage}%
                     </span>
                     <span className="text-[9px] font-bold text-white/50 tabular-nums">
                        ({count})
                     </span>
                  </div>
               )}
            </div>
         </button>

         {/* Expandable Voter List for Public Polls */}
         <AnimatePresence>
            {!isAnonymous && showVoters && voters.length > 0 && (
               <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  className="overflow-hidden px-2"
               >
                  <div className="p-2 rounded-lg bg-slate-950/70 border border-white/5 flex flex-wrap gap-1.5 items-center">
                     <Users size={10} className="text-indigo-400 shrink-0 mr-0.5" />
                     {voters.map((v) => (
                        <span
                           key={v.id}
                           className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-white/5 text-[9px] font-bold text-gray-300 border border-white/5"
                        >
                           <ProtectedAvatar
                              userId={v.id}
                              src={v.avatar_url}
                              username={v.username}
                              className="w-3 h-3 rounded-full"
                           />
                           {v.username}
                        </span>
                     ))}
                  </div>
               </motion.div>
            )}
         </AnimatePresence>
      </div>
   );
};

