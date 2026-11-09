import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, Shield, X } from "lucide-react";
import { PollFormStep } from "./PollFormStep";
import { PollOverviewStep } from "./PollOverviewStep";
import { createPoll, fetchActivePinnedPoll } from "../../../../services/pollService";
import type { Poll } from "../../../../types/poll";

interface CreatePollModalProps {
   isOpen: boolean;
   onClose: () => void;
   groupId: string;
   creatorId: string;
   creatorProfile?: { id: string; username: string; avatar_url: string };
   isAdmin: boolean;
   onPollCreated: (poll: Poll) => void;
}

export const CreatePollModal = ({
   isOpen,
   onClose,
   groupId,
   creatorId,
   creatorProfile,
   isAdmin,
   onPollCreated,
}: CreatePollModalProps) => {
   const [step, setStep] = useState<"form" | "overview">("form");
   const [question, setQuestion] = useState("");
   const [options, setOptions] = useState<string[]>(["", ""]);
   const [durationHours, setDurationHours] = useState<number>(24);
   const [allowChangeVote, setAllowChangeVote] = useState<boolean>(true);
   const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
   const [isPinned, setIsPinned] = useState<boolean>(false);
   const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
   const [existingPinnedPoll, setExistingPinnedPoll] = useState<Poll | null>(null);
   const [errorMsg, setErrorMsg] = useState<string | null>(null);

   useEffect(() => {
      if (isOpen && isAdmin && groupId) {
         void fetchActivePinnedPoll(groupId).then(setExistingPinnedPoll);
      }
   }, [isOpen, isAdmin, groupId]);

   const resetAndClose = () => {
      setStep("form");
      setQuestion("");
      setOptions(["", ""]);
      setDurationHours(24);
      setAllowChangeVote(true);
      setIsAnonymous(false);
      setIsPinned(false);
      setErrorMsg(null);
      onClose();
   };

   const handleConfirmCreate = async () => {
      if (isSubmitting) return;
      setIsSubmitting(true);
      setErrorMsg(null);
      try {
         const poll = await createPoll(
            {
               groupId,
               creatorId,
               question,
               options,
               durationHours,
               allowChangeVote,
               isAnonymous,
               isAdminPoll: isAdmin,
               isPinned: isAdmin && isPinned,
            },
            creatorProfile
         );
         onPollCreated(poll);
         resetAndClose();
      } catch (err: unknown) {
         setErrorMsg(err instanceof Error ? err.message : "Failed to create poll");
      } finally {
         setIsSubmitting(false);
      }
   };

   return (
      <AnimatePresence>
         {isOpen && (
            <div
               onClick={resetAndClose}
               className="fixed inset-0 z-[99998] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
            >
               <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 10 }}
                  onClick={(e) => e.stopPropagation()}
                  className="w-full max-w-md bg-slate-900 border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col max-h-[88vh] overflow-y-auto scrollbar-hide"
               >
                  {/* Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-3">
                     <div className="flex items-center gap-2">
                        <div
                           className={`p-1.5 rounded-lg ${
                              isAdmin
                                 ? "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                                 : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                           }`}
                        >
                           {isAdmin ? <Shield size={14} /> : <BarChart3 size={14} />}
                        </div>
                        <div>
                           <h3 className="text-xs font-black uppercase text-white tracking-wider">
                              {step === "form"
                                 ? isAdmin
                                    ? "Create Admin Poll"
                                    : "Create Community Poll"
                                 : "Poll Overview & Confirmation"}
                           </h3>
                           <p className="text-[10px] text-gray-400">
                              {step === "form"
                                 ? "Step 1 of 2 • Configure your General group poll"
                                 : "Step 2 of 2 • Confirm settings before posting"}
                           </p>
                        </div>
                     </div>

                     <button
                        type="button"
                        onClick={resetAndClose}
                        className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
                     >
                        <X size={15} />
                     </button>
                  </div>

                  {errorMsg && (
                     <div className="mb-3 p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-xs text-rose-300 font-semibold">
                        {errorMsg}
                     </div>
                  )}

                  {step === "form" ? (
                     <PollFormStep
                        question={question}
                        setQuestion={setQuestion}
                        options={options}
                        setOptions={setOptions}
                        durationHours={durationHours}
                        setDurationHours={setDurationHours}
                        allowChangeVote={allowChangeVote}
                        setAllowChangeVote={setAllowChangeVote}
                        isAnonymous={isAnonymous}
                        setIsAnonymous={setIsAnonymous}
                        isPinned={isPinned}
                        setIsPinned={setIsPinned}
                        isAdmin={isAdmin}
                        existingPinnedPoll={existingPinnedPoll}
                        onProceedToOverview={() => setStep("overview")}
                     />
                  ) : (
                     <PollOverviewStep
                        question={question}
                        options={options}
                        durationHours={durationHours}
                        allowChangeVote={allowChangeVote}
                        isAnonymous={isAnonymous}
                        isPinned={isPinned}
                        isAdmin={isAdmin}
                        isSubmitting={isSubmitting}
                        onBack={() => setStep("form")}
                        onConfirmSubmit={handleConfirmCreate}
                     />
                  )}
               </motion.div>
            </div>
         )}
      </AnimatePresence>
   );
};
