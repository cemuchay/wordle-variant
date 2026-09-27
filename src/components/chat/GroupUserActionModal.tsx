import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, MessageCircle, X } from "lucide-react";
import { ProtectedAvatar } from "./ProtectedAvatar";

interface GroupUserActionModalProps {
   targetUser: {
      userId: string;
      username: string;
      avatarUrl?: string;
   } | null;
   onClose: () => void;
   onViewProfile: (userId: string) => void;
   onReplyPrivately: (userId: string) => void;
}

export function GroupUserActionModal({
   targetUser,
   onClose,
   onViewProfile,
   onReplyPrivately,
}: GroupUserActionModalProps) {
   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         if (e.key === "Escape") onClose();
      };
      if (targetUser) {
         window.addEventListener("keydown", handleKeyDown);
      }
      return () => window.removeEventListener("keydown", handleKeyDown);
   }, [targetUser, onClose]);

   return (
      <AnimatePresence>
         {targetUser && (
            <motion.div
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               transition={{ duration: 0.15 }}
               onClick={onClose}
               className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs pointer-events-auto select-none"
            >
               <motion.div
                  initial={{ scale: 0.92, opacity: 0, y: 8 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.92, opacity: 0, y: 8 }}
                  transition={{ type: "spring", duration: 0.25, bounce: 0.1 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-full max-w-[280px] bg-[#1f2c34] border border-white/15 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] p-4 flex flex-col items-center gap-3.5"
               >
                  {/* Close button */}
                  <button
                     type="button"
                     onClick={onClose}
                     className="absolute top-3 right-3 p-1 rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                     title="Close"
                  >
                     <X size={16} />
                  </button>

                  {/* Target User Info */}
                  <div className="flex flex-col items-center gap-2 pt-1 text-center">
                     <ProtectedAvatar
                        userId={targetUser.userId}
                        src={targetUser.avatarUrl}
                        username={targetUser.username}
                        className="w-14 h-14 rounded-full border-2 border-indigo-500/50 shadow-md shadow-indigo-500/20"
                     />
                     <div className="flex flex-col items-center">
                        <span className="text-sm font-black text-white tracking-wide">
                           {targetUser.username}
                        </span>
                        <span className="text-[11px] text-indigo-300/80 font-semibold">
                           Group Member
                        </span>
                     </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="w-full flex flex-col gap-2 pt-1">
                     <button
                        type="button"
                        onClick={() => {
                           onViewProfile(targetUser.userId);
                           onClose();
                        }}
                        className="w-full flex items-center justify-center gap-2.5 py-2.5 px-3 bg-white/5 hover:bg-white/10 text-white rounded-xl font-bold text-xs transition-all cursor-pointer border border-white/10 active:scale-[0.98]"
                     >
                        <User size={15} className="text-indigo-400 shrink-0" />
                        <span>View Profile</span>
                     </button>

                     <button
                        type="button"
                        onClick={() => {
                           onReplyPrivately(targetUser.userId);
                           onClose();
                        }}
                        className="w-full flex items-center justify-center gap-2.5 py-2.5 px-3 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs transition-all cursor-pointer shadow-lg shadow-indigo-600/30 active:scale-[0.98]"
                     >
                        <MessageCircle size={15} className="shrink-0" />
                        <span>Reply Privately</span>
                     </button>
                  </div>
               </motion.div>
            </motion.div>
         )}
      </AnimatePresence>
   );
}
