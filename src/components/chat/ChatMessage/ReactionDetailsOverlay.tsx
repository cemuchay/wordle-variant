import { motion } from "framer-motion";
import { X, Smile } from "lucide-react";
import { ProtectedAvatar } from "../ProtectedAvatar";
import { useEffect } from "react";

interface ReactionUser {
   id: string;
   username?: string;
   avatar_url?: string;
}

interface ReactionDetailsOverlayProps {
   reactions: Record<string, string>;
   users?: ReactionUser[];
   currentUserId?: string;
   onClose: () => void;
   onSelectUser?: (userId: string) => void;
}

export function ReactionDetailsOverlay({
   reactions,
   users = [],
   currentUserId,
   onClose,
   onSelectUser,
}: ReactionDetailsOverlayProps) {
   const entries = Object.entries(reactions || {});
   const totalCount = entries.length;

   useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
         if (e.key === "Escape") onClose();
      };
      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
   }, [onClose]);

   return (
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
            className="relative w-full max-w-xs bg-[#1f2c34] border border-white/15 rounded-2xl shadow-[0_12px_40px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col"
         >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 bg-white/[0.02]">
               <div className="flex items-center gap-2">
                  <Smile size={16} className="text-amber-400" />
                  <span className="text-xs font-black uppercase tracking-wider text-white">
                     Reactions
                  </span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/10 text-white/70">
                     {totalCount}
                  </span>
               </div>
               <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                  title="Dismiss (Esc)"
               >
                  <X size={16} />
               </button>
            </div>

            {/* Reaction List */}
            <div className="p-2 max-h-64 overflow-y-auto flex flex-col gap-1 divide-y divide-white/5">
               {entries.map(([uid, emoji]) => {
                  const profile = users.find((p) => p.id === uid);
                  const isMe = uid === currentUserId;
                  const displayName = isMe ? "You" : profile?.username || "Player";

                  return (
                     <div
                        key={uid}
                        onClick={() => {
                           if (onSelectUser) {
                              onSelectUser(uid);
                           } else {
                              window.dispatchEvent(
                                 new CustomEvent("open-user-profile", {
                                    detail: { userId: uid },
                                 })
                              );
                           }
                           onClose();
                        }}
                        className="flex items-center justify-between p-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group"
                     >
                        <div className="flex items-center gap-2.5 min-w-0">
                           <ProtectedAvatar
                              userId={uid}
                              src={profile?.avatar_url}
                              username={profile?.username || displayName}
                              className="w-7 h-7 rounded-full shrink-0 border border-white/10 group-hover:scale-105 transition-transform"
                           />
                           <div className="flex flex-col min-w-0">
                              <span className="text-xs font-bold text-white truncate group-hover:text-indigo-300 transition-colors">
                                 {displayName}
                              </span>
                              {isMe && (
                                 <span className="text-[9px] text-white/40 font-medium">
                                    Your reaction
                                 </span>
                              )}
                           </div>
                        </div>
                        <span className="text-xl shrink-0 px-2 py-0.5 rounded-lg bg-white/5">
                           {emoji}
                        </span>
                     </div>
                  );
               })}
            </div>

            {/* Footer Dismiss Button */}
            <div className="p-2.5 border-t border-white/10 bg-white/[0.02]">
               <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-2 px-3 text-xs font-bold text-white/80 hover:text-white bg-white/10 hover:bg-white/15 rounded-xl transition-all cursor-pointer text-center"
               >
                  Dismiss
               </button>
            </div>
         </motion.div>
      </motion.div>
   );
}
