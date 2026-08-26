import { X, CheckCheck, Send } from "lucide-react";
import { getSeenBy } from "../../../utils/readReceipts";

interface MessageInfoModalProps {
   open: boolean;
   onClose: () => void;
   createdAt: string;
   kindLabel: string;
   peerReceipts: Record<string, string>;
   resolveName: (userId: string) => string;
}

const formatTime = (iso: string) =>
   new Date(iso).toLocaleString([], {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
   });

/**
 * WhatsApp-style message info sheet: sent time + per-reader seen times.
 * Degrades gracefully — when no reader data is visible it says so plainly.
 */
export default function MessageInfoModal({
   open,
   onClose,
   createdAt,
   kindLabel,
   peerReceipts,
   resolveName,
}: MessageInfoModalProps) {
   if (!open) return null;

   const seenBy = getSeenBy(createdAt, peerReceipts);

   return (
      <div
         className="fixed inset-0 z-[100000] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-150"
         onClick={onClose}
      >
         <div
            className="bg-slate-900 border border-white/15 rounded-2xl shadow-2xl w-full max-w-[300px] overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
         >
            <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-between">
               <span className="text-xs font-black uppercase tracking-wider text-gray-200">
                  Message Info
               </span>
               <button
                  type="button"
                  onClick={onClose}
                  className="p-1 text-gray-400 hover:text-white rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
               >
                  <X className="w-3.5 h-3.5" />
               </button>
            </div>

            <div className="p-4 space-y-3">
               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1">
                     Content
                  </p>
                  <p className="text-[11px] text-gray-300 truncate">{kindLabel}</p>
               </div>

               <div className="flex items-center gap-2">
                  <Send size={11} className="text-white/40 shrink-0" />
                  <span className="text-[10px] text-white/60">
                     Sent {formatTime(createdAt)}
                  </span>
               </div>

               <div>
                  <p className="text-[9px] font-black uppercase tracking-widest text-white/40 mb-1.5 flex items-center gap-1">
                     Seen
                     <CheckCheck size={10} className="text-blue-400" />
                  </p>
                  {seenBy.length === 0 ? (
                     <p className="text-[10px] text-white/30 italic">Not seen yet</p>
                  ) : (
                     <div className="space-y-1.5">
                        {seenBy.map(({ userId, at }) => (
                           <div key={userId} className="flex items-center justify-between gap-3">
                              <span className="text-[10px] font-bold text-white truncate">
                                 {resolveName(userId)}
                              </span>
                              <span className="text-[9px] text-white/40 shrink-0 flex items-center gap-1">
                                 {formatTime(at)}
                                 <CheckCheck size={10} className="text-blue-400" />
                              </span>
                           </div>
                        ))}
                     </div>
                  )}
               </div>
            </div>
         </div>
      </div>
   );
}
