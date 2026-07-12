import { motion } from "framer-motion";
import { Swords, Clock } from "lucide-react";

interface PlayNowLaterPopupProps {
   opponentName: string;
   category: string;
   onPlayNow: () => void;
   onLater: () => void;
}

export const PlayNowLaterPopup = ({ opponentName, category, onPlayNow, onLater }: PlayNowLaterPopupProps) => {
   return (
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-100 flex items-center justify-center p-4">
         <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-[#121212]/95 border border-white/10 rounded-3xl p-6 max-w-sm w-full shadow-2xl text-center space-y-5"
         >
            <div className="inline-flex p-3 bg-[#E85151]/10 rounded-full border border-[#E85151]/20 text-[#E85151]">
               <Swords size={24} />
            </div>

            <div className="space-y-1">
               <h3 className="text-lg font-black text-white">Challenge Created!</h3>
               <p className="text-sm text-white/80">
                  Match against <strong className="text-[#E85151]">{opponentName || "opponent"}</strong> is ready.
               </p>
               {category && (
                  <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-1">
                     Category: {category.replace(/_/g, " ")}
                  </p>
               )}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-2">
               <button
                  onClick={onPlayNow}
                  className="flex items-center justify-center gap-2 bg-[#E85151] hover:bg-[#d44343] text-white font-black uppercase text-[10px] tracking-widest py-3.5 rounded-xl transition-all cursor-pointer shadow-[0_4px_20px_rgba(232,81,81,0.3)]"
               >
                  <Swords size={14} />
                  Play Now
               </button>
               <button
                  onClick={onLater}
                  className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-black uppercase text-[10px] tracking-widest py-3.5 rounded-xl transition-all cursor-pointer"
               >
                  <Clock size={14} />
                  Later
               </button>
            </div>
         </motion.div>
      </div>
   );
};
