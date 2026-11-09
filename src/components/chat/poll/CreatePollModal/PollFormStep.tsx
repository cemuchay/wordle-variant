import { Plus, Trash2, EyeOff, RefreshCw, Pin, Shield, ArrowRight, AlertTriangle } from "lucide-react";
import { DurationSelector } from "./DurationSelector";
import { MIN_POLL_OPTIONS, MAX_POLL_OPTIONS, type Poll } from "../../../../types/poll";

interface PollFormStepProps {
   question: string;
   setQuestion: (q: string) => void;
   options: string[];
   setOptions: (opts: string[]) => void;
   durationHours: number;
   setDurationHours: (hrs: number) => void;
   allowChangeVote: boolean;
   setAllowChangeVote: (val: boolean) => void;
   isAnonymous: boolean;
   setIsAnonymous: (val: boolean) => void;
   isPinned: boolean;
   setIsPinned: (val: boolean) => void;
   isAdmin: boolean;
   existingPinnedPoll: Poll | null;
   onProceedToOverview: () => void;
}

export const PollFormStep = ({
   question,
   setQuestion,
   options,
   setOptions,
   durationHours,
   setDurationHours,
   allowChangeVote,
   setAllowChangeVote,
   isAnonymous,
   setIsAnonymous,
   isPinned,
   setIsPinned,
   isAdmin,
   existingPinnedPoll,
   onProceedToOverview,
}: PollFormStepProps) => {
   const validOptionsCount = options.filter((o) => o.trim().length > 0).length;
   const isValid = question.trim().length > 0 && validOptionsCount >= MIN_POLL_OPTIONS;

   const handleOptionChange = (index: number, value: string) => {
      const next = [...options];
      next[index] = value;
      setOptions(next);
   };

   const handleAddOption = () => {
      if (options.length < MAX_POLL_OPTIONS) {
         setOptions([...options, ""]);
      }
   };

   const handleRemoveOption = (index: number) => {
      if (options.length > MIN_POLL_OPTIONS) {
         setOptions(options.filter((_, idx) => idx !== index));
      }
   };

   return (
      <div className="space-y-4">
         {/* Question */}
         <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
               Poll Question *
            </label>
            <input
               type="text"
               maxLength={180}
               value={question}
               onChange={(e) => setQuestion(e.target.value)}
               placeholder="Ask the General community a question..."
               className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-white/30 outline-none focus:border-indigo-400 transition-all"
            />
         </div>

         {/* Options */}
         <div className="space-y-2">
            <div className="flex items-center justify-between">
               <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">
                  Options ({options.length}/{MAX_POLL_OPTIONS}) *
               </label>
               {options.length < MAX_POLL_OPTIONS && (
                  <button
                     type="button"
                     onClick={handleAddOption}
                     className="inline-flex items-center gap-1 text-[10px] font-black uppercase text-indigo-400 hover:text-indigo-300 cursor-pointer"
                  >
                     <Plus size={12} />
                     Add Option
                  </button>
               )}
            </div>

            <div className="space-y-2">
               {options.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-1.5">
                     <span className="w-5 text-center text-[10px] font-black text-gray-500">
                        {idx + 1}.
                     </span>
                     <input
                        type="text"
                        maxLength={90}
                        value={opt}
                        onChange={(e) => handleOptionChange(idx, e.target.value)}
                        placeholder={`Option ${idx + 1}`}
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-xs text-white placeholder-white/30 outline-none focus:border-indigo-400 transition-all"
                     />
                     {options.length > MIN_POLL_OPTIONS && (
                        <button
                           type="button"
                           onClick={() => handleRemoveOption(idx)}
                           className="p-2 text-gray-500 hover:text-rose-400 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                           title="Remove option"
                        >
                           <Trash2 size={13} />
                        </button>
                     )}
                  </div>
               ))}
            </div>
         </div>

         {/* Duration Selector */}
         <DurationSelector durationHours={durationHours} onChange={setDurationHours} />

         {/* Optional Configurations */}
         <div className="space-y-2 pt-1 border-t border-white/10">
            <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider block">
               Poll Configuration
            </label>

            {/* Allow Change Vote Toggle */}
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
               <div className="flex items-center gap-2.5 pr-2">
                  <RefreshCw size={14} className="text-indigo-400 shrink-0" />
                  <div>
                     <p className="text-xs font-bold text-white">Allow changing vote</p>
                     <p className="text-[10px] text-gray-400">
                        Voters can switch their choice before poll ends (1 vote max)
                     </p>
                  </div>
               </div>
               <input
                  type="checkbox"
                  checked={allowChangeVote}
                  onChange={(e) => setAllowChangeVote(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
               />
            </label>

            {/* Anonymous Poll Toggle */}
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-colors">
               <div className="flex items-center gap-2.5 pr-2">
                  <EyeOff size={14} className="text-purple-400 shrink-0" />
                  <div>
                     <p className="text-xs font-bold text-white">Anonymous poll</p>
                     <p className="text-[10px] text-gray-400">
                        Hide voter names and avatars on results
                     </p>
                  </div>
               </div>
               <input
                  type="checkbox"
                  checked={isAnonymous}
                  onChange={(e) => setIsAnonymous(e.target.checked)}
                  className="w-4 h-4 accent-indigo-500 rounded cursor-pointer"
               />
            </label>

            {/* Admin Only: Pin Poll to Top of Chat */}
            {isAdmin && (
               <div className="space-y-1.5">
                  <label className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 cursor-pointer hover:bg-amber-500/15 transition-colors">
                     <div className="flex items-center gap-2.5 pr-2">
                        <Pin size={14} className="text-amber-400 shrink-0" />
                        <div>
                           <div className="flex items-center gap-1.5">
                              <p className="text-xs font-bold text-amber-200">
                                 Pin to top of General chat
                              </p>
                              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[8px] font-black uppercase inline-flex items-center gap-0.5">
                                 <Shield size={8} /> Admin
                              </span>
                           </div>
                           <p className="text-[10px] text-amber-200/70">
                              Pins this poll on top of the chat for its lifetime (max 1 active)
                           </p>
                        </div>
                     </div>
                     <input
                        type="checkbox"
                        checked={isPinned}
                        onChange={(e) => setIsPinned(e.target.checked)}
                        className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                     />
                  </label>

                  {isPinned && existingPinnedPoll && (
                     <div className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/15 border border-amber-500/30 text-[10px] text-amber-200">
                        <AlertTriangle size={13} className="text-amber-400 shrink-0 mt-0.5" />
                        <span>
                           Active pinned poll <strong>"{existingPinnedPoll.question}"</strong> will
                           be automatically unpinned when this poll is published (max 1 pinned admin
                           poll at a time).
                        </span>
                     </div>
                  )}
               </div>
            )}
         </div>

         {/* Proceed to Overview Button */}
         <button
            type="button"
            disabled={!isValid}
            onClick={onProceedToOverview}
            className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:hover:bg-indigo-600 text-white text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer"
         >
            <span>Review Poll Overview</span>
            <ArrowRight size={14} />
         </button>
      </div>
   );
};

