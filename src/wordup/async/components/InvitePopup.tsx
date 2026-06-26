import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Swords, Clock, Check, X, ChevronRight } from "lucide-react";

interface InvitePopupProps {
   invite: any;
   onAccept: () => void;
   onLater: () => void;
   onDecline: () => void;
}

export const InvitePopup = ({ invite, onAccept, onLater, onDecline }: InvitePopupProps) => {
   const [countdown, setCountdown] = useState(15);

   useEffect(() => {
      if (!invite) return;
      setCountdown(15);
      const interval = setInterval(() => {
         setCountdown((prev) => {
            if (prev <= 1) { clearInterval(interval); return 0; }
            return prev - 1;
         });
      }, 1000);
      return () => clearInterval(interval);
   }, [invite]);

   useEffect(() => {
      if (countdown <= 0) onLater();
   }, [countdown]);

   return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-100 flex items-center justify-center p-4">
         <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-gray-900 border border-indigo-500/30 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-5"
         >
            <div className="inline-flex p-3 bg-indigo-500/10 rounded-full border border-indigo-500/20 text-indigo-400">
               <Swords size={24} />
            </div>

            <div className="space-y-1">
               <h3 className="text-lg font-black text-white">WordUp Challenge!</h3>
               <p className="text-sm text-gray-300">
                  <strong className="text-indigo-400">{invite.senderName}</strong> has challenged you to an <strong className="text-white">Async WordUp Battle</strong>!
               </p>
               {invite.category && (
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider mt-1">
                     Category: {invite.category.replace(/_/g, " ")}
                  </p>
               )}
            </div>

            <div className="flex items-center justify-center gap-1.5 text-yellow-400 text-[10px] font-black uppercase tracking-wider">
               <Clock size={12} />
               <span>Auto-saving in {countdown}s</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
               <button
                  onClick={onAccept}
                  className="flex flex-col items-center gap-1 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-400 text-[9px] font-black uppercase tracking-widest py-3 rounded-xl transition-all cursor-pointer"
               >
                  <Check size={14} />
                  Accept
               </button>
               <button
                  onClick={onLater}
                  className="flex flex-col items-center gap-1 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 text-indigo-400 text-[9px] font-black uppercase tracking-widest py-3 rounded-xl transition-all cursor-pointer"
               >
                  <ChevronRight size={14} />
                  Later
               </button>
               <button
                  onClick={onDecline}
                  className="flex flex-col items-center gap-1 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 text-[9px] font-black uppercase tracking-widest py-3 rounded-xl transition-all cursor-pointer"
               >
                  <X size={14} />
                  Decline
               </button>
            </div>
         </motion.div>
      </div>
   );
};
